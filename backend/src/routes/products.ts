import { Router } from 'express';
import { listProductsHandler, getProductHandler } from '../controllers/product.controller';
import { validateQuery, validateParams, uuidParam } from '../middleware/validate';
import { productQuerySchema } from '../schemas/product.schema';

export const productsRouter = Router();

/**
 * GET /api/products
 * List products with pagination, filtering, and sorting.
 * Query: page, limit, sortBy, sortOrder, search, isActive, inStock, minPrice, maxPrice
 */
productsRouter.get(
  '/',
  validateQuery(productQuerySchema),
  listProductsHandler
);

/**
 * GET /api/products/:id
 * Get a single product by ID.
 */
productsRouter.get(
  '/:id',
  validateParams(uuidParam),
  getProductHandler
);
