import { z } from 'zod';

export const reserveSchema = z.object({
  productId: z.string().uuid('productId must be a valid UUID'),
  quantity: z.number().int().positive('quantity must be a positive integer').max(100),
  // userId will come from JWT in the auth step; accepted in body for now
  userId: z.string().uuid('userId must be a valid UUID'),
});

export const checkoutSchema = z.object({
  reservationId: z.string().uuid('reservationId must be a valid UUID'),
});

export const reservationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'expiresAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  userId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED']).optional(),
});

export type ReserveInput = z.infer<typeof reserveSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ReservationQuery = z.infer<typeof reservationQuerySchema>;
