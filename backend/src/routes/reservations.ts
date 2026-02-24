import { Router } from 'express';
import {
  reserveHandler,
  listReservationsHandler,
  getReservationHandler,
} from '../controllers/reservation.controller';
import { validateBody, validateParams, validateQuery, uuidParam } from '../middleware/validate';
import { reserveSchema, reservationQuerySchema } from '../schemas/reservation.schema';
import { reserveRateLimiter } from '../middleware/rateLimiter';

export const reservationsRouter = Router();

/**
 * GET /api/reservations
 * List reservations with pagination, filtering, and sorting.
 * Query: page, limit, sortBy, sortOrder, userId, productId, status
 */
reservationsRouter.get(
  '/',
  validateQuery(reservationQuerySchema),
  listReservationsHandler
);

/**
 * GET /api/reservations/:id
 * Get a single reservation by ID.
 */
reservationsRouter.get(
  '/:id',
  validateParams(uuidParam),
  getReservationHandler
);

/**
 * POST /api/reservations
 * Reserve stock for a product.
 * Body: { productId, quantity, userId }
 */
reservationsRouter.post(
  '/',
  reserveRateLimiter,
  validateBody(reserveSchema),
  reserveHandler
);
