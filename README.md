# Limited-Stock Product Drop System

A full-stack reservation system that safely handles 100+ concurrent users competing for limited stock.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│  ProductDropPage                                                │
│    └─ useProducts (polls /api/products every 5s)               │
│    └─ ProductCard                                               │
│         ├─ useReservation  (state machine: idle→reserved→done) │
│         ├─ useCountdown    (1s tick from expiresAt)            │
│         └─ API layer       (fetch + ApiError)                  │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP (Vite proxy in dev / CORS in prod)
┌────────────────────────▼────────────────────────────────────────┐
│                    Express 5 API (Node.js)                       │
│                                                                  │
│  POST /api/reservations  →  ReservationService                  │
│  POST /api/checkout      →  CheckoutService                     │
│  GET  /api/products      →  ProductService                      │
│  GET  /api/health        →  DB liveness                         │
│  GET  /api/metrics       →  process + counters                  │
│                                                                  │
│  Middleware stack:                                               │
│    helmet → CORS → requestId → morgan → rateLimit → bodyParser  │
│                                                                  │
│  Background: ExpirationJob (setInterval 60s)                    │
└────────────────────────┬────────────────────────────────────────┘
                         │ Prisma 7 + @prisma/adapter-pg
┌────────────────────────▼────────────────────────────────────────┐
│                     PostgreSQL                                   │
│                                                                  │
│   users ─────┐                                                  │
│   products ──┼──── reservations ──── orders                    │
│              └──────────────────── inventory_logs               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+

### Backend

```bash
cd backend
cp .env.example .env          # fill in DATABASE_URL
npm install
npm run prisma:migrate        # creates tables
npm run prisma:seed           # seeds sample products
npm run dev                   # starts on :3001
```

### Frontend

```bash
cd frontend
cp .env.example .env          # VITE_API_URL=http://localhost:3001/api
npm install
npm run dev                   # starts on :5173
```

### Tests

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

---

## How Race Conditions Are Handled

### The Problem

100 users hit `POST /reserve` simultaneously. Without protection, multiple requests could read `stock = 1`, all pass the availability check, and all deduct — leaving `stock = -99`.

### The Solution: Optimistic Locking

Every `Product` row has a `version` integer. The stock deduction is an atomic conditional update:

```sql
UPDATE products
SET stock = stock - :qty, version = version + 1
WHERE id = :id
  AND version = :currentVersion   -- optimistic lock
  AND stock >= :qty               -- safety guard
```

Translated to Prisma:

```typescript
const result = await tx.product.updateMany({
  where: { id, version: currentVersion, stock: { gte: qty } },
  data:  { stock: { decrement: qty }, version: { increment: 1 } },
});

if (result.count === 0) throw new OptimisticLockError();
```

Only **one** transaction can win a given version tick. The losers get `count = 0`, catch `OptimisticLockError`, and retry up to **3 times** with exponential back-off (50 ms → 100 ms). If all retries are exhausted the user gets a clear 409 "High demand" response.

### Why Not `SELECT FOR UPDATE`?

Pessimistic locking (`SELECT ... FOR UPDATE`) would work too, but it holds a row-level lock for the entire transaction duration. Under high load this creates a serial bottleneck — every request queues behind the one holding the lock. Optimistic locking lets all requests proceed in parallel and only serialises at the point of the write, which is much faster.

### Duplicate Reservation Prevention

Inside the same transaction, before the stock deduction, we check:

```typescript
const existing = await tx.reservation.findFirst({
  where: { userId, productId, status: 'PENDING' },
});
if (existing) throw new ConflictError('Already have an active reservation');
```

A PostgreSQL partial unique index (applied in the migration) enforces this at the DB level too:

```sql
CREATE UNIQUE INDEX unique_pending_reservation
ON reservations (user_id, product_id)
WHERE status = 'PENDING';
```

Prisma does not support partial indexes in `schema.prisma`, so this is added as raw SQL in the initial migration.

---

## Schema Decisions

### Why a `version` column on `Product`?

It is the lock token for optimistic concurrency. Without it, two transactions that both read `stock = 5` would both pass `stock >= 1` and both decrement — resulting in `stock = 3` instead of the correct `stock = 4`.

### Why keep `totalStock` separate from `stock`?

`stock` is the live mutable count (decrements on reserve, increments on expiry). `totalStock` is immutable — it records what we started with for reporting ("47 of 100 remaining") and percentage calculations.

### Why is `InventoryLog` append-only?

Every stock change (reserve, release, purchase) writes a row to `inventory_logs`. Rows are never updated or deleted. This gives a complete, tamper-evident audit trail that lets you reconstruct the stock level at any point in history and debug any discrepancy. `stockBefore` and `stockAfter` are denormalised into each row so you don't need to replay history to read the state at a moment.

### Why does `Reservation` have a `status` enum instead of a `completedAt` nullable column?

Status is a first-class concept with four distinct states (`PENDING`, `COMPLETED`, `EXPIRED`, `CANCELLED`). Using an enum makes filtering cheap and unambiguous. A nullable `completedAt` would blur the distinction between expired and cancelled.

### Why `Order.reservationId` unique?

A one-to-one constraint enforces that a single reservation can only be checked out once. Without it, a race between two simultaneous checkout requests for the same `reservationId` could create two orders.

---

## Tradeoffs

| Decision | Benefit | Cost |
|---|---|---|
| Optimistic locking | No row-level locks, high throughput | Retries add latency under extreme contention |
| In-process scheduler | No external cron dependency, works on Render free tier | Stops running if the process crashes; not suitable for multi-instance deployments |
| In-memory metrics | Zero dependencies, instant | Lost on restart; not aggregated across instances |
| `userId` in request body | Simple to test without auth | Not production-safe — JWT auth is required before real deployment |
| Single Prisma `$transaction` per operation | Atomic, no partial failures | All-or-nothing — a slow DB means the whole request is slow |

---

## What Would Break at 10,000 Concurrent Users

### 1. Single Node.js process
Node.js is single-threaded. At 10k concurrent requests the event loop saturates. CPU-bound work (Zod validation, JSON serialisation) blocks new requests from being processed.

**Fix:** Horizontal scaling — run multiple instances behind a load balancer (e.g. Render's auto-scaling, Fly.io, or ECS).

### 2. PostgreSQL connection pool exhaustion
With 10k concurrent requests and a `pg.Pool` defaulting to 10 connections, requests queue up waiting for a free connection. Queue depth grows unbounded.

**Fix:** Use PgBouncer in transaction-pooling mode in front of PostgreSQL. Each Node.js instance holds a small pool (5–10); PgBouncer multiplexes thousands of app connections onto a handful of DB connections.

### 3. Optimistic lock retries amplify DB load
At 10k users all retrying 3 times for 5 stock units, you get up to 30,000 `UPDATE` attempts for 5 winners. Each failed attempt is a wasted round-trip.

**Fix:** Use a Redis-backed distributed queue (e.g. BullMQ) per product. Each incoming reserve request enqueues a job; a single consumer per product processes them serially — zero lock contention, zero wasted retries.

### 4. Expiration job runs in-process
One scheduler instance expiring reservations is fine at low scale. With 10k users and thousands of expiring reservations per minute, the single job becomes a bottleneck and its DB queries compete with user traffic.

**Fix:** Move the expiration job to a separate worker process/service. Use `pg_cron` (PostgreSQL extension) for the trigger to avoid relying on application availability.

### 5. Real-time stock polling (5s interval × 10k browsers)
10,000 browsers polling every 5 seconds = 2,000 requests/second to `GET /api/products`. This hits the DB on every request.

**Fix:** Cache product stock in Redis with a 3-second TTL. Invalidate the cache whenever stock changes. Serve the polling endpoint from the cache — near-zero DB load.

---

## How to Scale It

```
Browser ──► CDN (static assets)
         │
         ▼
    Load Balancer (Render / ALB)
         │
    ┌────┴────┐
    │  API 1  │  API 2  │  API N  │   ← horizontal scale
    └────┬────┘
         │
    PgBouncer (connection pooling)
         │
    PostgreSQL (primary + read replica)
         │
    ┌────┴──────────────────┐
    Redis                   │
    ├─ Stock cache (3s TTL) │
    ├─ BullMQ job queues    │
    └─ Rate-limit counters  │
                            │
    Worker Process ─────────┘
    └─ Expiration job (dedicated)
    └─ BullMQ consumers (per product)
```

**Summary of changes:**
1. Run `N` API instances behind a load balancer
2. Add Redis for stock caching, distributed rate limiting, and job queues
3. Replace the in-process scheduler with a dedicated worker + `pg_cron`
4. Add PgBouncer between the app and PostgreSQL
5. Replace optimistic locking with per-product BullMQ queue for zero-contention reserve

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | DB liveness check |
| `GET` | `/api/metrics` | Process + business counters |
| `GET` | `/api/products` | List products (paginated, filterable, sortable) |
| `GET` | `/api/products/:id` | Single product |
| `POST` | `/api/reservations` | Create reservation |
| `GET` | `/api/reservations` | List reservations |
| `GET` | `/api/reservations/:id` | Single reservation |
| `POST` | `/api/checkout` | Checkout a reservation |

### `POST /api/reservations`
```json
{ "productId": "uuid", "quantity": 1, "userId": "uuid" }
```
Response `201`:
```json
{
  "success": true,
  "data": {
    "reservationId": "uuid",
    "expiresAt": "2025-01-01T12:05:00.000Z",
    "quantity": 1,
    "product": { "id": "uuid", "name": "Air Jordan 1", "price": 180, "remainingStock": 99 }
  }
}
```

### `POST /api/checkout`
```json
{ "reservationId": "uuid" }
```
Response `201`:
```json
{
  "success": true,
  "data": {
    "orderId": "uuid",
    "totalPrice": 180,
    "quantity": 1,
    "status": "CONFIRMED",
    "product": { "id": "uuid", "name": "Air Jordan 1", "price": 180 },
    "createdAt": "2025-01-01T12:03:00.000Z"
  }
}
```

---

## Tech Stack

### Backend
| | |
|---|---|
| Runtime | Node.js 20 + TypeScript 5 (strict) |
| Framework | Express 5 |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Database | PostgreSQL 15 |
| Validation | Zod 4 |
| Logging | Winston + Morgan |
| Rate limiting | express-rate-limit |
| Security | Helmet |
| Testing | Jest 30 + ts-jest |

### Frontend
| | |
|---|---|
| Bundler | Vite 6 |
| UI | React 19 + TypeScript 5 (strict) |
| Styling | Tailwind CSS v4 |
| Components | Radix UI primitives + CVA |
| Icons | Lucide React |
| Testing | Vitest 4 + React Testing Library |

---

## Loom Video

> **TODO:** Record a 5–8 minute walkthrough covering:
> 1. Architecture overview (diagram above)
> 2. Live demo: open two browsers, both try to reserve the last unit — show one wins
> 3. Walk through `reservation.service.ts` — explain optimistic lock + retry loop
> 4. Show `expireReservations.job.ts` — explain why stock is re-fetched inside the transaction
> 5. Run `npm test` in both directories and show all 35 tests passing
> 6. Explain what would break at 10k and the Redis/BullMQ scaling path
