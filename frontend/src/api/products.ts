import { apiClient, toQueryString } from './client';
import type {
  ApiResponse,
  PaginatedResponse,
  Product,
  ProductQueryParams,
} from '../types/api';

export async function getProducts(
  params: ProductQueryParams = {}
): Promise<PaginatedResponse<Product>> {
  const qs = toQueryString(params as Record<string, unknown>);
  return apiClient.get(`/products${qs}`);
}

export async function getProduct(id: string): Promise<ApiResponse<Product>> {
  return apiClient.get(`/products/${id}`);
}
