import { Prisma } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';
import { config } from '../lib/config';
import { metrics } from '../lib/metrics';
import { logger } from '../utils/logger';
import { ConflictError, NotFoundError } from '../utils/errors';
import {
  ReservationStatus,
  InventoryChangeType,
} from '../generated/prisma/client';
import type {
  ReserveInput,
  ReservationQuery,
} from '../schemas/reservation.schema';
import type { PaginationMeta } from '../types';

// ─── Types returned to the controller ────────────────────────────────────────

export interface ReservationResult {
  reservationId: string;
  expiresAt: Date;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    remainingStock: number;
  };
}

// ─── Core reserve logic ───────────────────────────────────────────────────────

/**
 * Reserve stock for a product.
 *
 * Concurrency strategy:
 *   1. All reads + writes run inside a single DB transaction.
 *   2. Optimistic locking on Product.version ensures only one winner when
 *      multiple requests race for the same stock at the same time.
 *      If `updateMany` returns count=0 the product row was modified by another
 *      transaction first → we retry up to MAX_RETRIES times with a short
 *      exponential back-off.
 *   3. A PENDING reservation check inside the same transaction prevents a
 *      single user from holding duplicate reservations.
 */
export async function createReservation(
  input: ReserveInput
): Promise<ReservationResult> {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // ── 1. Verify user exists ───────────────────────────────────────────
        const user = await tx.user.findUnique({ where: { id: input.userId } });
        if (!user) throw new NotFoundError('User');

        // ── 2. Fetch product ────────────────────────────────────────────────
        const product = await tx.product.findUnique({
          where: { id: input.productId },
        });

        if (!product) throw new NotFoundError('Product');
        if (!product.isActive)
          throw new ConflictError('Product is not currently available');
        if (product.stock < input.quantity)
          throw new ConflictError(
            `Only ${product.stock} unit(s) left in stock`
          );

        // ── 3. Duplicate PENDING reservation guard ──────────────────────────
        const existing = await tx.reservation.findFirst({
          where: {
            userId: input.userId,
            productId: input.productId,
            status: ReservationStatus.PENDING,
          },
        });

        if (existing) {
          throw new ConflictError(
            'You already have an active reservation for this product'
          );
        }

        // ── 3. Atomic stock deduction with optimistic lock ──────────────────
        // updateMany with version + stock check ensures:
        //  - stock never goes negative
        //  - only one concurrent winner per version tick
        const stockBefore = product.stock;

        const updated = await tx.product.updateMany({
          where: {
            id: input.productId,
            version: product.version, // optimistic lock
            stock: { gte: input.quantity }, // extra guard
          },
          data: {
            stock: { decrement: input.quantity },
            version: { increment: 1 },
          },
        });

        if (updated.count === 0) {
          // Another concurrent transaction won the race — signal retry
          throw new OptimisticLockError();
        }

        const stockAfter = stockBefore - input.quantity;

        // ── 4. Create reservation ───────────────────────────────────────────
        const expiresAt = new Date(
          Date.now() + config.reservationTtlMinutes * 60 * 1000
        );

        const reservation = await tx.reservation.create({
          data: {
            userId: input.userId,
            productId: input.productId,
            quantity: input.quantity,
            // status defaults to PENDING in the schema — omitting it avoids a
            // Prisma 7 XOR-mode ambiguity with the checked (relation) input type
            expiresAt,
          },
        });

        // ── 5. Append inventory audit log ───────────────────────────────────
        await tx.inventoryLog.create({
          data: {
            productId: input.productId,
            reservationId: reservation.id,
            changeType: InventoryChangeType.RESERVED,
            quantityChange: -input.quantity,
            stockBefore,
            stockAfter,
            reason: `Reservation created`,
          },
        });

        metrics.reservationsCreated++;

        return {
          reservationId: reservation.id,
          expiresAt: reservation.expiresAt,
          quantity: reservation.quantity,
          product: {
            id: product.id,
            name: product.name,
            price: Number(product.price),
            remainingStock: stockAfter,
          },
        };
      });
    } catch (err) {
      if (err instanceof OptimisticLockError && attempt < MAX_RETRIES - 1) {
        // Exponential back-off: 50ms, 100ms, …
        const delay = 50 * Math.pow(2, attempt);
        logger.warn(
          `Optimistic lock conflict on attempt ${attempt + 1}, retrying in ${delay}ms`
        );
        await sleep(delay);
        continue;
      }

      if (err instanceof OptimisticLockError) {
        throw new ConflictError(
          'High demand — could not secure stock, please try again'
        );
      }

      throw err;
    }
  }

  // TypeScript requires a return; the loop above always returns or throws
  throw new ConflictError('Reservation failed after maximum retries');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

class OptimisticLockError extends Error {
  constructor() {
    super('OPTIMISTIC_LOCK_FAILURE');
  }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// ─── List reservations ────────────────────────────────────────────────────────

export interface ReservationItem {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  quantity: number;
  status: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface ReservationListResult {
  reservations: ReservationItem[];
  meta: PaginationMeta;
}

export async function listReservations(
  query: ReservationQuery
): Promise<ReservationListResult> {
  const { page, limit, sortBy, sortOrder, userId, productId, status } = query;

  const where: Prisma.ReservationWhereInput = {};
  if (userId) where.userId = userId;
  if (productId) where.productId = productId;
  if (status) where.status = status as ReservationStatus;

  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    prisma.reservation.count({ where }),
    prisma.reservation.findMany({
      where,
      include: { product: { select: { name: true } } },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
  ]);

  const reservations: ReservationItem[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    productId: r.productId,
    productName: r.product.name,
    quantity: r.quantity,
    status: r.status,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
  }));

  return {
    reservations,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// ─── Single reservation ───────────────────────────────────────────────────────

export async function getReservation(id: string): Promise<ReservationItem> {
  const r = await prisma.reservation.findUnique({
    where: { id },
    include: { product: { select: { name: true } } },
  });
  if (!r) throw new NotFoundError('Reservation');

  return {
    id: r.id,
    userId: r.userId,
    productId: r.productId,
    productName: r.product.name,
    quantity: r.quantity,
    status: r.status,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
  };
}
