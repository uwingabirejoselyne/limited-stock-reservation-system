import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('email must be a valid email address'),
  name: z.string().min(1, 'name is required').max(100),
  password: z.string().min(8, 'password must be at least 8 characters'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
