import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './lib/config';
import { metrics } from './lib/metrics';
import { requestId } from './middleware/requestId';
import { requestLogger } from './middleware/requestLogger';
import { globalRateLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';

export const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (config.allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
  })
);

// ── Request ID (attach before logger so ID appears in every log line) ─────────
app.use(requestId);

// ── Request logging ───────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Global request counter ────────────────────────────────────────────────────
app.use((_req, _res, next) => {
  metrics.requestCount++;
  next();
});

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use(globalRateLimiter);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ── Centralized error handler (must be last) ──────────────────────────────────
app.use(errorHandler);
