import { expireReservations } from './expireReservations.job';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../lib/prisma', () => {
  const { buildPrismaMock } = require('../test/prismaMock');
  return { prisma: buildPrismaMock() };
});

jest.mock('../lib/metrics', () => ({
  metrics: { reservationsExpired: 0 },
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mock = prisma as any;

function makeExpiredReservation(id: string, productId = 'p1') {
  return { id, productId, quantity: 2 };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('expireReservations()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does nothing when there are no expired reservations', async () => {
    mock.reservation.findMany.mockResolvedValue([]);

    await expireReservations();

    expect(mock.$transaction).not.toHaveBeenCalled();
  });

  it('processes each expired reservation inside its own transaction', async () => {
    mock.reservation.findMany.mockResolvedValue([
      makeExpiredReservation('r1'),
      makeExpiredReservation('r2'),
    ]);
    mock.product.findUniqueOrThrow.mockResolvedValue({ stock: 5 });
    mock.product.update.mockResolvedValue({});
    mock.reservation.update.mockResolvedValue({});
    mock.inventoryLog.create.mockResolvedValue({});

    await expireReservations();

    // One transaction per expired reservation
    expect(mock.$transaction).toHaveBeenCalledTimes(2);
  });

  it('restores stock with the correct quantity', async () => {
    mock.reservation.findMany.mockResolvedValue([makeExpiredReservation('r1')]);
    mock.product.findUniqueOrThrow.mockResolvedValue({ stock: 7 });
    mock.product.update.mockResolvedValue({});
    mock.reservation.update.mockResolvedValue({});
    mock.inventoryLog.create.mockResolvedValue({});

    await expireReservations();

    expect(mock.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          stock: { increment: 2 }, // reservation.quantity = 2
          version: { increment: 1 },
        },
      })
    );
  });

  it('marks the reservation as EXPIRED', async () => {
    mock.reservation.findMany.mockResolvedValue([makeExpiredReservation('r1')]);
    mock.product.findUniqueOrThrow.mockResolvedValue({ stock: 5 });
    mock.product.update.mockResolvedValue({});
    mock.reservation.update.mockResolvedValue({});
    mock.inventoryLog.create.mockResolvedValue({});

    await expireReservations();

    expect(mock.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'r1',
          status: 'PENDING',
        }),
        data: { status: 'EXPIRED' },
      })
    );
  });

  it('creates a RELEASED InventoryLog entry with correct stock values', async () => {
    mock.reservation.findMany.mockResolvedValue([makeExpiredReservation('r1')]);
    mock.product.findUniqueOrThrow.mockResolvedValue({ stock: 8 });
    mock.product.update.mockResolvedValue({});
    mock.reservation.update.mockResolvedValue({});
    mock.inventoryLog.create.mockResolvedValue({});

    await expireReservations();

    expect(mock.inventoryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changeType: 'RELEASED',
          quantityChange: 2,
          stockBefore: 8,
          stockAfter: 10, // 8 + 2 restored
          reservationId: 'r1',
        }),
      })
    );
  });

  it('continues processing remaining reservations when one fails', async () => {
    mock.reservation.findMany.mockResolvedValue([
      makeExpiredReservation('r-bad'),
      makeExpiredReservation('r-good'),
    ]);

    // Make the $transaction fail for the first call, succeed for the second
    mock.$transaction
      .mockRejectedValueOnce(new Error('DB error'))
      .mockImplementation((fn: (tx: unknown) => unknown) => fn(mock));

    mock.product.findUniqueOrThrow.mockResolvedValue({ stock: 5 });
    mock.product.update.mockResolvedValue({});
    mock.reservation.update.mockResolvedValue({});
    mock.inventoryLog.create.mockResolvedValue({});

    // Should not throw
    await expect(expireReservations()).resolves.toBeUndefined();
    expect(mock.$transaction).toHaveBeenCalledTimes(2);
  });
});
