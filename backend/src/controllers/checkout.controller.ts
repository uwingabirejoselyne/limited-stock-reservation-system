import type { Response, NextFunction } from 'express';
import type { TypedRequest } from '../types';
import { processCheckout } from '../services/checkout.service';
import type { CheckoutInput } from '../schemas/reservation.schema';

export async function checkoutHandler(
  req: TypedRequest<CheckoutInput>,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await processCheckout(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
