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

export type ReserveInput = z.infer<typeof reserveSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
