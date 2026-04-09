import { Router } from 'express';
import { createUserHandler } from '../controllers/user.controller';
import { validateBody } from '../middleware/validate';
import { createUserSchema } from '../schemas/user.schema';

export const usersRouter = Router();

/**
 * POST /api/users
 * Register a new user. Returns the user id to use as userId in reservation requests.
 */
usersRouter.post('/', validateBody(createUserSchema), createUserHandler);
