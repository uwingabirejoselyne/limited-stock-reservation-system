import { z } from 'zod';

// Query-string booleans arrive as the strings 'true' / 'false'
const booleanString = z
  .string()
  .optional()
  .transform((v) => {
    if (v === 'true') return true;
    if (v === 'false') return false;
    return undefined;
  });

export const productQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z
    .enum(['name', 'price', 'stock', 'createdAt'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  isActive: booleanString,
  inStock: booleanString,
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
});

export type ProductQuery = z.infer<typeof productQuerySchema>;
