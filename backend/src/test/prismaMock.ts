/**
 * Shared Prisma mock factory.
 * Call buildPrismaMock() in each test file's jest.mock factory.
 *
 * The $transaction mock automatically executes interactive callbacks
 * (fn => fn(tx)) so service code that wraps logic in prisma.$transaction
 * works without modification.
 */
export function buildPrismaMock() {
  const tx = {
    product: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    reservation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    inventoryLog: {
      create: jest.fn(),
    },
    order: {
      create: jest.fn(),
    },
  };

  return {
    ...tx,
    $transaction: jest.fn().mockImplementation(
      // Support both: prisma.$transaction([q1, q2]) and prisma.$transaction(fn)
      (arg: unknown) => {
        if (Array.isArray(arg)) return Promise.all(arg);
        if (typeof arg === 'function') return (arg as (t: typeof tx) => unknown)(tx);
        return Promise.resolve();
      }
    ),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };
}

export type PrismaMock = ReturnType<typeof buildPrismaMock>;
