import { createReservation } from './reservation.service';
import { ConflictError, NotFoundError } from '../utils/errors';

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tx = (prisma as any);

const PRODUCT = {
  id: 'product-uuid-1',
  name: 'Test Sneaker',
  description: null,
  price: { toNumber: () => 180 },
  stock: 10,
  totalStock: 100,
  isActive: true,
  version: 3,
};

const INPUT = {
  productId: PRODUCT.id,
  quantity: 1,
  userId: 'user-uuid-1',
};

function mockReservation(overrides = {}) {
  return {
    id: 'reservation-uuid-1',
    userId: INPUT.userId,
    productId: INPUT.productId,
    quantity: INPUT.quantity,
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createReservation()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a reservation when stock is available', async () => {
    tx.product.findUnique.mockResolvedValue(PRODUCT);
    tx.reservation.findFirst.mockResolvedValue(null);
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    tx.reservation.create.mockResolvedValue(mockReservation());
    tx.inventoryLog.create.mockResolvedValue({});

    const result = await createReservation(INPUT);

    expect(result.reservationId).toBe('reservation-uuid-1');
    expect(result.quantity).toBe(1);
    expect(result.product.name).toBe(PRODUCT.name);
  });

  it('deducts stock with the correct optimistic lock fields', async () => {
    tx.product.findUnique.mockResolvedValue(PRODUCT);
    tx.reservation.findFirst.mockResolvedValue(null);
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    tx.reservation.create.mockResolvedValue(mockReservation());
    tx.inventoryLog.create.mockResolvedValue({});

    await createReservation(INPUT);

    expect(tx.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: PRODUCT.id,
          version: PRODUCT.version,
          stock: { gte: INPUT.quantity },
        }),
        data: {
          stock: { decrement: INPUT.quantity },
          version: { increment: 1 },
        },
      })
    );
  });

  it('throws NotFoundError when product does not exist', async () => {
    tx.product.findUnique.mockResolvedValue(null);

    await expect(createReservation(INPUT)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ConflictError when product is inactive', async () => {
    tx.product.findUnique.mockResolvedValue({ ...PRODUCT, isActive: false });

    await expect(createReservation(INPUT)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('not currently available'),
    });
  });

  it('throws ConflictError when stock is insufficient', async () => {
    tx.product.findUnique.mockResolvedValue({ ...PRODUCT, stock: 0 });

    await expect(createReservation(INPUT)).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws ConflictError when user already has a PENDING reservation', async () => {
    tx.product.findUnique.mockResolvedValue(PRODUCT);
    tx.reservation.findFirst.mockResolvedValue(mockReservation()); // existing!

    await expect(createReservation(INPUT)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('already have an active reservation'),
    });
  });

  it('retries on optimistic lock failure and succeeds on the next attempt', async () => {
    tx.product.findUnique.mockResolvedValue(PRODUCT);
    tx.reservation.findFirst.mockResolvedValue(null);
    tx.reservation.create.mockResolvedValue(mockReservation());
    tx.inventoryLog.create.mockResolvedValue({});

    // Fail once, then succeed
    tx.product.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValue({ count: 1 });

    const result = await createReservation(INPUT);

    expect(result.reservationId).toBe('reservation-uuid-1');
    expect(tx.product.updateMany).toHaveBeenCalledTimes(2);
  });

  it('throws ConflictError after exhausting all retries', async () => {
    tx.product.findUnique.mockResolvedValue(PRODUCT);
    tx.reservation.findFirst.mockResolvedValue(null);
    tx.product.updateMany.mockResolvedValue({ count: 0 }); // always fails

    await expect(createReservation(INPUT)).rejects.toBeInstanceOf(ConflictError);
    expect(tx.product.updateMany).toHaveBeenCalledTimes(3); // MAX_RETRIES
  });

  it('creates an InventoryLog entry for every successful reservation', async () => {
    tx.product.findUnique.mockResolvedValue(PRODUCT);
    tx.reservation.findFirst.mockResolvedValue(null);
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    tx.reservation.create.mockResolvedValue(mockReservation());
    tx.inventoryLog.create.mockResolvedValue({});

    await createReservation(INPUT);

    expect(tx.inventoryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changeType: 'RESERVED',
          quantityChange: -INPUT.quantity,
          stockBefore: PRODUCT.stock,
          stockAfter: PRODUCT.stock - INPUT.quantity,
        }),
      })
    );
  });
});
