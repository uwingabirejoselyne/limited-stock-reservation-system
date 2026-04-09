import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// Singleton pool — reuse connections across requests.
// For Neon DB: use the DIRECT connection URL (not the pooled/PgBouncer URL).
// The pooled URL (ending in -pooler.neon.tech or containing ?pgbouncer=true)
// runs PgBouncer in transaction mode which blocks interactive transactions (P2028).
// Set DATABASE_URL to the direct connection string from the Neon dashboard.
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  // Keep the pool small — Neon's free tier limits concurrent connections
  max: 5,
  // Give Neon's cold-start compute enough time to wake up
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

const adapter = new PrismaPg(pool);

// Singleton Prisma client.
// Increase transaction timeouts to handle Neon DB cold-start latency:
//   maxWait – how long Prisma waits to acquire a transaction slot (default 2 s)
//   timeout  – how long the entire transaction can run           (default 5 s)
export const prisma = new PrismaClient({
  adapter,
  transactionOptions: {
    maxWait: 10_000,
    timeout: 30_000,
  },
});

// Gracefully disconnect on process exit
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  await pool.end();
});
