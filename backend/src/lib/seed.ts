import 'dotenv/config';
import { prisma } from './prisma';
import { logger } from '../utils/logger';

async function main() {
  logger.info('Seeding database...');

  // Clear existing data (order matters due to FK constraints)
  await prisma.inventoryLog.deleteMany();
  await prisma.order.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  // Seed users
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'alice@example.com',
        name: 'Alice',
        password: '$2b$10$placeholder_hash_alice', // bcrypt hash placeholder
      },
    }),
    prisma.user.create({
      data: {
        email: 'bob@example.com',
        name: 'Bob',
        password: '$2b$10$placeholder_hash_bob',
      },
    }),
  ]);

  // Seed products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Air Jordan 1 Retro High OG',
        description: 'Limited edition sneaker drop — only 100 pairs available.',
        price: 180.0,
        stock: 100,
        totalStock: 100,
      },
    }),
    prisma.product.create({
      data: {
        name: 'PS5 Limited Edition Bundle',
        description: 'PlayStation 5 with limited-edition controller.',
        price: 599.99,
        stock: 50,
        totalStock: 50,
      },
    }),
  ]);

  logger.info(`Seeded ${users.length} users and ${products.length} products`);
  logger.info('Done.');
}

main()
  .catch((err) => {
    logger.error('Seed failed', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().catch(() => {}));
