import { Router } from 'express';
import { checkoutHandler } from '../controllers/checkout.controller';
import { validateBody } from '../middleware/validate';
import { checkoutSchema } from '../schemas/reservation.schema';

export const checkoutRouter = Router();

/**
 * POST /api/checkout
 * Convert a valid PENDING reservation into a confirmed Order.
 * Body: { reservationId }
 */
checkoutRouter.post('/', validateBody(checkoutSchema), checkoutHandler);
