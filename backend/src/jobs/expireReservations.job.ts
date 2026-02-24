import { prisma } from '../lib/prisma';
import { metrics } from '../lib/metrics';
import { logger } from '../utils/logger';
import {
  ReservationStatus,
  InventoryChangeType,
} from '../generated/prisma/client';

const BATCH_SIZE = 100; // process at most 100 per tick

/**
 * Find every PENDING reservation whose expiresAt is in the past,
 * restore its stock, and mark it EXPIRED — all in per-reservation
 * transactions so a single failure never blocks the rest of the batch.
 */
export async function expireReservations(): Promise<void> {
  const now = new Date();

  // ── 1. Fetch expired reservations (minimal fields) ──────────────────────
  const expired = await prisma.reservation.findMany({
    where: {
      status: ReservationStatus.PENDING,
      expiresAt: { lt: now },
    },
    select: { id: true, productId: true, quantity: true },
    take: BATCH_SIZE,
  });

  if (expired.length === 0) return;

  logger.info(
    `Expiration job: processing ${expired.length} expired reservation(s)`
  );

  let successCount = 0;

  for (const reservation of expired) {
    try {
      await prisma.$transaction(async (tx) => {
        // Re-fetch current stock inside the transaction — the initial
        // findMany snapshot is stale after the first iteration commits.
        const product = await tx.product.findUniqueOrThrow({
          where: { id: reservation.productId },
          select: { stock: true },
        });

        const stockBefore = product.stock;
        const stockAfter = stockBefore + reservation.quantity;

        // ── Restore stock ───────────────────────────────────────────────
        await tx.product.update({
          where: { id: reservation.productId },
          data: {
            stock: { increment: reservation.quantity },
            version: { increment: 1 },
          },
        });

        // ── Mark EXPIRED (WHERE status=PENDING guards against double-processing)
        await tx.reservation.update({
          where: {
            id: reservation.id,
            status: ReservationStatus.PENDING,
          },
          data: { status: ReservationStatus.EXPIRED },
        });

        // ── Append audit log ────────────────────────────────────────────
        await tx.inventoryLog.create({
          data: {
            productId: reservation.productId,
            reservationId: reservation.id,
            changeType: InventoryChangeType.RELEASED,
            quantityChange: reservation.quantity, // positive = restored
            stockBefore,
            stockAfter,
            reason: 'Reservation expired — stock restored',
          },
        });
      });

      successCount++;
      metrics.reservationsExpired++;
    } catch (err) {
      // Log and continue — one bad row must not halt the whole batch
      logger.error(
        `Expiration job: failed to expire reservation ${reservation.id}`,
        err
      );
    }
  }

  logger.info(
    `Expiration job: expired ${successCount}/${expired.length} reservation(s)`
  );
}
