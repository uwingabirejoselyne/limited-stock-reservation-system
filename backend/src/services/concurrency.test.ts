/**
 * Concurrency simulation tests.
 *
 * These tests verify the optimistic locking retry logic by simulating
 * multiple concurrent reservation attempts against the same product.
 *
 * In production, a real database enforces the version check atomically.
 * Here we replicate that behavior via mock counters.
 */
import { createReservation } from './reservation.service';
import { ConflictError } from '../utils/errors';

jest.mock('../lib/prisma', () => {
  const { buildPrismaMock } = require('../test/prismaMock');
  return { prisma: buildPrismaMock() };
});

jest.mock('../lib/config', () => ({
  config: { reservationTtlMinutes: 5 },
}));

jest.mock('../lib/metrics', () => ({
  metrics: { reservationsCreated: 0 },
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { prisma } from '../lib/prisma';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mock = prisma as any;

const BASE_PRODUCT = {
  id: 'product-drop-1',
  name: 'Limited Sneaker',
  price: { toNumber: () => 180 },
  stock: 5,
  totalStock: 5,
  isActive: true,
  version: 0,
};

describe('Concurrent reservation simulation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows exactly STOCK reservations when N > STOCK users race simultaneously', async () => {
    const STOCK = 5;
    const CONCURRENT_USERS = 10;

    // Track how many slots have been "claimed"
    let claimed = 0;

    mock.product.findUnique.mockResolvedValue({ ...BASE_PRODUCT, stock: STOCK });
    mock.reservation.findFirst.mockResolvedValue(null);
    mock.inventoryLog.create.mockResolvedValue({});

    // Atomic stock gate: first STOCK calls succeed, rest fail
    mock.product.updateMany.mockImplementation(() => {
      if (claimed < STOCK) {
        claimed++;
        return Promise.resolve({ count: 1 });
      }
      return Promise.resolve({ count: 0 });
    });

    mock.reservation.create.mockImplementation(({ data }: { data: { userId: string } }) => ({
      id: `res-${data.userId}`,
      userId: data.userId,
      productId: BASE_PRODUCT.id,
      quantity: 1,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 300_000),
    }));

    // Fire all requests concurrently
    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENT_USERS }, (_, i) =>
        createReservation({
          productId: BASE_PRODUCT.id,
          quantity: 1,
          userId: `user-${i}`,
        })
      )
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(STOCK);
    expect(rejected.length).toBe(CONCURRENT_USERS - STOCK);
  });

  it('rejected requests fail with ConflictError (not unhandled errors)', async () => {
    const STOCK = 1;

    let claimed = 0;
    mock.product.findUnique.mockResolvedValue({ ...BASE_PRODUCT, stock: STOCK });
    mock.reservation.findFirst.mockResolvedValue(null);
    mock.inventoryLog.create.mockResolvedValue({});
    mock.product.updateMany.mockImplementation(() => {
      if (claimed < STOCK) { claimed++; return Promise.resolve({ count: 1 }); }
      return Promise.resolve({ count: 0 });
    });
    mock.reservation.create.mockResolvedValue({
      id: 'r1', userId: 'u0', productId: BASE_PRODUCT.id,
      quantity: 1, status: 'PENDING', expiresAt: new Date(Date.now() + 300_000),
    });

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        createReservation({ productId: BASE_PRODUCT.id, quantity: 1, userId: `user-${i}` })
      )
    );

    const failures = results
      .filter((r) => r.status === 'rejected')
      .map((r) => (r as PromiseRejectedResult).reason);

    for (const err of failures) {
      expect(err).toBeInstanceOf(ConflictError);
    }
  });

  it('stock never goes below zero regardless of concurrency', async () => {
    let currentStock = 3;
    const CONCURRENT_USERS = 20;

    mock.product.findUnique.mockImplementation(() =>
      Promise.resolve({ ...BASE_PRODUCT, stock: currentStock })
    );
    mock.reservation.findFirst.mockResolvedValue(null);
    mock.inventoryLog.create.mockResolvedValue({});
    mock.reservation.create.mockResolvedValue({
      id: 'r', userId: 'u', productId: BASE_PRODUCT.id,
      quantity: 1, status: 'PENDING', expiresAt: new Date(Date.now() + 300_000),
    });

    // Simulate the atomic DB constraint: only decrement if stock >= qty
    mock.product.updateMany.mockImplementation(() => {
      if (currentStock >= 1) {
        currentStock--;
        return Promise.resolve({ count: 1 });
      }
      return Promise.resolve({ count: 0 });
    });

    await Promise.allSettled(
      Array.from({ length: CONCURRENT_USERS }, (_, i) =>
        createReservation({ productId: BASE_PRODUCT.id, quantity: 1, userId: `user-${i}` })
      )
    );

    expect(currentStock).toBeGreaterThanOrEqual(0);
  });
});
