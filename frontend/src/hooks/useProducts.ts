import { useState, useEffect, useCallback, useRef } from 'react';
import { getProducts } from '@/api/products';
import { ApiError } from '@/api/client';
import type { Product, ProductQueryParams } from '@/types/api';

interface UseProductsResult {
  products: Product[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const POLL_INTERVAL = 5_000; // 5 s — spec requirement

export function useProducts(params: ProductQueryParams = {}): UseProductsResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable ref so the interval closure doesn't go stale
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const fetchProducts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getProducts(paramsRef.current);
      setProducts(res.data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to load products'
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProducts();
    const id = setInterval(() => void fetchProducts(true), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchProducts]);

  return { products, loading, error, refetch: () => void fetchProducts() };
}
