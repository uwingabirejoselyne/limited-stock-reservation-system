import type { Request, Response, NextFunction } from 'express';
import { listProducts, getProduct } from '../services/product.service';
import type { ProductQuery } from '../schemas/product.schema';

export async function listProductsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await listProducts(req.query as unknown as ProductQuery);
    res.json({ success: true, data: result.products, meta: result.meta });
  } catch (err) {
    next(err);
  }
}

export async function getProductHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const product = await getProduct(req.params['id'] as string);
    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}
