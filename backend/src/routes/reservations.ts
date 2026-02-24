import { Router } from 'express';
import { reserveHandler } from '../controllers/reservation.controller';
import { validateBody } from '../middleware/validate';
import { reserveSchema } from '../schemas/reservation.schema';
import { reserveRateLimiter } from '../middleware/rateLimiter';

export const reservationsRouter = Router();

/**
 * POST /api/reservations
 * Reserve stock for a product.
 * Body: { productId, quantity, userId }
 */
reservationsRouter.post(
  '/',
  reserveRateLimiter,           // tight rate limit (10 req/min per IP)
  validateBody(reserveSchema),  // Zod validation
  reserveHandler
);
