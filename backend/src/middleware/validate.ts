import type { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors';

type RequestPart = 'body' | 'params' | 'query';

export function validate<T>(schema: ZodSchema<T>, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      return next(new ValidationError(message));
    }
    // Replace the request part with the parsed (coerced/stripped) value.
    // In Express 5, req.query and req.params are getter-only on the prototype,
    // so direct assignment throws. Use Object.defineProperty to shadow them with
    // an own data property on this specific request instance.
    if (part === 'body') {
      req.body = result.data;
    } else {
      Object.defineProperty(req, part, {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    next();
  };
}

// Convenience shorthands
export const validateBody = <T>(schema: ZodSchema<T>) =>
  validate(schema, 'body');

export const validateParams = <T>(schema: ZodSchema<T>) =>
  validate(schema, 'params');

export const validateQuery = <T>(schema: ZodSchema<T>) =>
  validate(schema, 'query');

// Common reusable schemas
export const uuidParam = z.object({ id: z.string().uuid('Invalid UUID') });

export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
