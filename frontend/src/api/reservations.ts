import { apiClient, toQueryString } from './client';
import type {
  ApiResponse,
  PaginatedResponse,
  Reservation,
  ReservationResult,
  OrderResult,
  ReserveRequest,
  CheckoutRequest,
  ReservationQueryParams,
} from '../types/api';

export async function createReservation(
  body: ReserveRequest
): Promise<ApiResponse<ReservationResult>> {
  return apiClient.post('/reservations', body);
}

export async function getReservations(
  params: ReservationQueryParams = {}
): Promise<PaginatedResponse<Reservation>> {
  const qs = toQueryString(params as Record<string, unknown>);
  return apiClient.get(`/reservations${qs}`);
}

export async function getReservation(
  id: string
): Promise<ApiResponse<Reservation>> {
  return apiClient.get(`/reservations/${id}`);
}

export async function checkout(
  body: CheckoutRequest
): Promise<ApiResponse<OrderResult>> {
  return apiClient.post('/checkout', body);
}
