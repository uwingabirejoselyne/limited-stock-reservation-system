import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '../generated/prisma/client';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { metrics } from '../lib/metrics';
import type { ApiResponse } from '../types';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  metrics.errorCount++;

  // ── Operational errors (our own AppError subclasses) ─────────────────────
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`[${req.requestId}] ${err.message}`, { stack: err.stack });
    } else {
      logger.warn(`[${req.requestId}] ${err.message}`);
    }

    const body: ApiResponse = { success: false, error: err.message };
    res.status(err.statusCode).json(body);
    return;
  }

  // ── Prisma known request errors ───────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.warn(`[${req.requestId}] Prisma error ${err.code}: ${err.message}`);

    if (err.code === 'P2002') {
      res.status(409).json({ success: false, error: 'Resource already exists' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Record not found' });
      return;
    }

    res.status(400).json({ success: false, error: 'Database request error' });
    return;
  }

  // ── Prisma validation errors ──────────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.warn(`[${req.requestId}] Prisma validation: ${err.message}`);
    res.status(400).json({ success: false, error: 'Invalid database query' });
    return;
  }

  // ── Unknown / programmer errors ───────────────────────────────────────────
  const message = err instanceof Error ? err.message : 'Internal server error';
  logger.error(`[${req.requestId}] Unhandled error: ${message}`, {
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({ success: false, error: 'Internal server error' });
}

// 404 handler — must be registered after all routes
export function notFoundHandler(req: Request, res: Response) {
  res
    .status(404)
    .json({ success: false, error: `Cannot ${req.method} ${req.path}` });
}
