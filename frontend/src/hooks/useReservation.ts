import { useState, useCallback } from 'react';
import { createReservation, checkout } from '@/api/reservations';
import { ApiError } from '@/api/client';
import { ensureUser } from '@/lib/user';
import type { ReservationResult, OrderResult } from '@/types/api';

// ─── Discriminated union state machine ───────────────────────────────────────

type ReservationState =
  | { status: 'idle' }
  | { status: 'reserving' }
  | { status: 'reserved'; data: ReservationResult; checkoutError?: string }
  | { status: 'checking-out'; data: ReservationResult }
  | { status: 'completed'; order: OrderResult }
  | { status: 'expired' }
  | { status: 'error'; message: string };

interface UseReservationResult {
  state: ReservationState;
  reserve: (productId: string, quantity: number) => Promise<void>;
  completeCheckout: () => Promise<void>;
  markExpired: () => void;
  reset: () => void;
}

export function useReservation(): UseReservationResult {
  const [state, setState] = useState<ReservationState>({ status: 'idle' });

  const reserve = useCallback(
    async (productId: string, quantity: number) => {
      setState({ status: 'reserving' });
      try {
        const userId = await ensureUser();
        const res = await createReservation({ productId, quantity, userId });
        setState({ status: 'reserved', data: res.data });
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Reservation failed — try again';
        setState({ status: 'error', message });
      }
    },
    []
  );

  const completeCheckout = useCallback(async () => {
    if (state.status !== 'reserved') return;
    const reservationData = state.data;
    setState({ status: 'checking-out', data: reservationData });
    try {
      const res = await checkout({ reservationId: reservationData.reservationId });
      setState({ status: 'completed', order: res.data });
    } catch (err) {
      const checkoutError =
        err instanceof ApiError ? err.message : 'Checkout failed — try again';
      // Stay in 'reserved' so the countdown keeps running and the user can retry.
      // checkoutError is rendered inline by ProductCard.
      setState({ status: 'reserved', data: reservationData, checkoutError });
    }
  }, [state]);

  const markExpired = useCallback(() => setState({ status: 'expired' }), []);
  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, reserve, completeCheckout, markExpired, reset };
}
