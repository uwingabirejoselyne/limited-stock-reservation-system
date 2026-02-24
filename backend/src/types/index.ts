import type { Request } from 'express';

// Consistent API response envelope
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Extended request carrying a typed body after Zod validation
export type TypedRequest<TBody = unknown, TParams = unknown, TQuery = unknown> =
  Request<
    TParams extends Record<string, string> ? TParams : Record<string, string>,
    ApiResponse,
    TBody,
    TQuery extends Record<string, string>
      ? TQuery
      : Record<string, string>
  >;
