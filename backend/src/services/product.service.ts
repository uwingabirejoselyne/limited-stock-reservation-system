import { Prisma } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../utils/errors';
import type { ProductQuery } from '../schemas/product.schema';
import type { PaginationMeta } from '../types';

export interface ProductItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  totalStock: number;
  isActive: boolean;
  createdAt: Date;
}

export interface ProductListResult {
  products: ProductItem[];
  meta: PaginationMeta;
}

// ── List products ─────────────────────────────────────────────────────────────

export async function listProducts(
  query: ProductQuery
): Promise<ProductListResult> {
  const { page, limit, sortBy, sortOrder, search, isActive, inStock, minPrice, maxPrice } = query;

  const where: Prisma.ProductWhereInput = {};

  if (isActive !== undefined) where.isActive = isActive;
  if (inStock) where.stock = { gt: 0 };
  if (search) where.name = { contains: search, mode: 'insensitive' };

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {
      ...(minPrice !== undefined && { gte: new Prisma.Decimal(minPrice) }),
      ...(maxPrice !== undefined && { lte: new Prisma.Decimal(maxPrice) }),
    };
  }

  const skip = (page - 1) * limit;

  // Parallel count + data fetch in one round-trip
  const [total, rows] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
  ]);

  const products: ProductItem[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    stock: p.stock,
    totalStock: p.totalStock,
    isActive: p.isActive,
    createdAt: p.createdAt,
  }));

  return {
    products,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ── Single product ────────────────────────────────────────────────────────────

export async function getProduct(id: string): Promise<ProductItem> {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new NotFoundError('Product');

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    stock: product.stock,
    totalStock: product.totalStock,
    isActive: product.isActive,
    createdAt: product.createdAt,
  };
}
