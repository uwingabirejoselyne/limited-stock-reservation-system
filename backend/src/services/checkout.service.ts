import { prisma } from '../lib/prisma';
import { metrics } from '../lib/metrics';
import { ConflictError, GoneError, NotFoundError } from '../utils/errors';
import {
  ReservationStatus,
  InventoryChangeType,
} from '../generated/prisma/client';
import type { CheckoutInput } from '../schemas/reservation.schema';

// ─── Response type ────────────────────────────────────────────────────────────

export interface OrderResult {
  orderId: string;
  totalPrice: number;
  quantity: number;
  status: string;
  product: {
    id: string;
    name: string;
    price: number;
  };
  createdAt: Date;
}

// ─── Checkout logic ───────────────────────────────────────────────────────────

/**
 * Convert a PENDING reservation into a confirmed Order.
 *
 * Stock is NOT changed here — it was already deducted when the reservation
 * was created. The PURCHASED InventoryLog entry records the finalization.
 *
 * All writes are inside a single transaction so a partial failure
 * (e.g. order created but reservation not updated) can never happen.
 */
export async function processCheckout(
  input: CheckoutInput
): Promise<OrderResult> {
  return prisma.$transaction(async (tx) => {
    // ── 1. Fetch reservation + product in one query ───────────────────────
    const reservation = await tx.reservation.findUnique({
      where: { id: input.reservationId },
      include: { product: true },
    });

    if (!reservation) throw new NotFoundError('Reservation');

    // ── 2. Validate reservation status ────────────────────────────────────
    if (reservation.status === ReservationStatus.COMPLETED) {
      throw new ConflictError('Reservation has already been checked out');
    }
    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new GoneError('Reservation has been cancelled');
    }
    if (reservation.status === ReservationStatus.EXPIRED) {
      throw new GoneError('Reservation has expired');
    }

    // ── 3. Belt-and-suspenders expiry check ───────────────────────────────
    // The expiration job runs periodically, so a reservation may still be
    // PENDING in the DB while past its expiresAt. Check the timestamp too.
    if (new Date() > reservation.expiresAt) {
      // Keep the DB consistent while we're here
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.EXPIRED },
      });
      throw new GoneError('Reservation has expired');
    }

    // ── 4. Create Order ───────────────────────────────────────────────────
    const totalPrice =
      Number(reservation.product.price) * reservation.quantity;

    const order = await tx.order.create({
      data: {
        userId: reservation.userId,
        reservationId: reservation.id,
        productId: reservation.productId,
        quantity: reservation.quantity,
        totalPrice,
        // status defaults to CONFIRMED in the schema — omitting it avoids the
        // same Prisma 7 XOR-mode ambiguity fixed in reservation.service.ts
      },
    });

    // ── 5. Mark reservation COMPLETED ─────────────────────────────────────
    await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: ReservationStatus.COMPLETED },
    });

    // ── 6. Append audit log ───────────────────────────────────────────────
    // quantityChange = 0 because stock was already deducted at reserve time.
    // stockBefore === stockAfter — this log entry records finalization only.
    const currentStock = reservation.product.stock;

    await tx.inventoryLog.create({
      data: {
        productId: reservation.productId,
        reservationId: reservation.id,
        changeType: InventoryChangeType.PURCHASED,
        quantityChange: 0,
        stockBefore: currentStock,
        stockAfter: currentStock,
        reason: `Order ${order.id} confirmed`,
      },
    });

    metrics.checkoutsCompleted++;

    return {
      orderId: order.id,
      totalPrice: Number(order.totalPrice),
      quantity: order.quantity,
      status: order.status,
      product: {
        id: reservation.product.id,
        name: reservation.product.name,
        price: Number(reservation.product.price),
      },
      createdAt: order.createdAt,
    };
  });
}
