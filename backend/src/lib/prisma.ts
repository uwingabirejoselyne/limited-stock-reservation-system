import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// Singleton pool — reuse connections across requests
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
});

const adapter = new PrismaPg(pool);

// Singleton Prisma client
export const prisma = new PrismaClient({ adapter });

// Gracefully disconnect on process exit
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  await pool.end();
});
