import type { Request, Response, NextFunction } from 'express';
import type { TypedRequest } from '../types';
import {
  createReservation,
  listReservations,
  getReservation,
} from '../services/reservation.service';
import type {
  ReserveInput,
  ReservationQuery,
} from '../schemas/reservation.schema';

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

export async function listReservationsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await listReservations(req.query as unknown as ReservationQuery);
    res.json({ success: true, data: result.reservations, meta: result.meta });
  } catch (err) {
    next(err);
  }
}

export async function getReservationHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const reservation = await getReservation(req.params['id'] as string);
    res.json({ success: true, data: reservation });
  } catch (err) {
    next(err);
  }
}
