// ─── Shared envelope ──────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Product ──────────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  totalStock: number;
  isActive: boolean;
  createdAt: string;
}

// ─── Reservation ─────────────────────────────────────────────────────────────

export type ReservationStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

export interface Reservation {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
}

export interface ReservationResult {
  reservationId: string;
  expiresAt: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    remainingStock: number;
  };
}

// ─── Order ────────────────────────────────────────────────────────────────────

export interface OrderResult {
  orderId: string;
  totalPrice: number;
  quantity: number;
  status: string;
  product: {
    id: string;
    name: string;
    price: number;
  };
  createdAt: string;
}

// ─── Request bodies ───────────────────────────────────────────────────────────

export interface ReserveRequest {
  productId: string;
  quantity: number;
  userId: string;
}

export interface CheckoutRequest {
  reservationId: string;
}

// ─── Query params ─────────────────────────────────────────────────────────────

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'price' | 'stock' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  search?: string;
  isActive?: boolean;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export interface ReservationQueryParams {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'expiresAt';
  sortOrder?: 'asc' | 'desc';
  userId?: string;
  productId?: string;
  status?: ReservationStatus;
}
