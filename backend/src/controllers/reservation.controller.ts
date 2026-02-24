import type { Response, NextFunction } from 'express';
import type { TypedRequest } from '../types';
import { createReservation } from '../services/reservation.service';
import type { ReserveInput } from '../schemas/reservation.schema';

export async function reserveHandler(
  req: TypedRequest<ReserveInput>,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await createReservation(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
