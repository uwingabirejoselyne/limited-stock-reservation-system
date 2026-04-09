import type { Request, Response, NextFunction } from 'express';
import { createUser } from '../services/user.service';
import type { CreateUserInput } from '../schemas/user.schema';

export async function createUserHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await createUser(req.body as CreateUserInput);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}
