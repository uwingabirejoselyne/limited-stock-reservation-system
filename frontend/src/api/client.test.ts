import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError, toQueryString } from './client';

// ─── toQueryString ────────────────────────────────────────────────────────────

describe('toQueryString', () => {
  it('returns empty string for empty params', () => {
    expect(toQueryString({})).toBe('');
  });

  it('serializes params correctly', () => {
    const qs = toQueryString({ page: 1, limit: 20 });
    expect(qs).toBe('?page=1&limit=20');
  });

  it('skips undefined and null values', () => {
    const qs = toQueryString({ page: 1, search: undefined, filter: null });
    expect(qs).toBe('?page=1');
  });

  it('handles boolean values', () => {
    const qs = toQueryString({ inStock: true, isActive: false });
    expect(qs).toContain('inStock=true');
    expect(qs).toContain('isActive=false');
  });
});

// ─── apiClient ────────────────────────────────────────────────────────────────

describe('apiClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(status: number, body: unknown) {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });
  }

  it('returns parsed JSON on 2xx', async () => {
    mockFetch(200, { success: true, data: { id: 'abc' } });

    const result = await apiClient.get('/products/abc');
    expect(result).toEqual({ success: true, data: { id: 'abc' } });
  });

  it('throws ApiError with correct status and message on 404', async () => {
    mockFetch(404, { error: 'Product not found' });

    await expect(apiClient.get('/products/missing')).rejects.toMatchObject({
      status: 404,
      message: 'Product not found',
    });
  });

  it('throws ApiError on 409 conflict', async () => {
    mockFetch(409, { error: 'Insufficient stock' });

    const err = await apiClient
      .post('/reservations', { productId: 'x', quantity: 1, userId: 'u' })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    expect((err as ApiError).message).toBe('Insufficient stock');
  });

  it('throws ApiError on 429 rate limit', async () => {
    mockFetch(429, { error: 'Too many requests, please slow down.' });

    const err = await apiClient.get('/reservations').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(429);
  });

  it('throws ApiError with fallback message when body has no error field', async () => {
    mockFetch(500, {});

    const err = await apiClient.get('/health').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
    expect((err as ApiError).message).toContain('500');
  });

  it('sends POST with JSON body and Content-Type header', async () => {
    mockFetch(201, { success: true, data: { reservationId: 'r1' } });

    await apiClient.post('/reservations', { productId: 'p1' });

    const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify({ productId: 'p1' }));
    expect((options.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });
});
