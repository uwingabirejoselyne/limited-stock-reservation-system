import { Router } from 'express';
import type { Request, Response } from 'express';
import { metrics } from '../lib/metrics';

export const metricsRouter = Router();

metricsRouter.get('/', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();

  res.json({
    uptime: Math.floor(process.uptime()),
    memory: {
      heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)} MB`,
      rss: `${Math.round(mem.rss / 1024 / 1024)} MB`,
    },
    counters: {
      requests: metrics.requestCount,
      errors: metrics.errorCount,
      reservationsCreated: metrics.reservationsCreated,
      reservationsExpired: metrics.reservationsExpired,
      checkoutsCompleted: metrics.checkoutsCompleted,
    },
  });
});
