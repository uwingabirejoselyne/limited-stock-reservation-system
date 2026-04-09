import { useEffect } from 'react';
import { ShoppingCart, RotateCcw, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { StockIndicator } from '@/components/StockIndicator';
import { CountdownTimer } from '@/components/CountdownTimer';
import { useReservation } from '@/hooks/useReservation';
import { useCountdown } from '@/hooks/useCountdown';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/api';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { state, reserve, completeCheckout, markExpired, reset } =
    useReservation();

  const expiresAt =
    state.status === 'reserved' || state.status === 'checking-out'
      ? state.data.expiresAt
      : null;

  const { minutes, seconds, progress, isExpired } = useCountdown(expiresAt);

  // Transition to expired state when countdown hits zero
  useEffect(() => {
    if (isExpired && state.status === 'reserved') {
      markExpired();
    }
  }, [isExpired, state.status, markExpired]);

  const isSoldOut = product.stock === 0;

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-zinc-100">{product.name}</h2>
        {product.description && (
          <p className="mt-1 text-sm text-zinc-400">{product.description}</p>
        )}
      </div>

      {/* Price */}
      <p className="text-3xl font-bold text-white">
        ${product.price.toFixed(2)}
      </p>

      {/* Stock indicator — always visible, updates on each poll */}
      <StockIndicator stock={product.stock} totalStock={product.totalStock} />

      {/* ── State-driven UI ────────────────────────────────────────────── */}

      {/* IDLE / SOLD OUT */}
      {(state.status === 'idle' || state.status === 'error') && (
        <div className="space-y-3">
          {state.status === 'error' && (
            <div className="flex items-start gap-2 rounded-lg bg-red-950/50 border border-red-800 p-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{state.message}</span>
            </div>
          )}
          <Button
            className="w-full"
            disabled={isSoldOut}
            onClick={() => void reserve(product.id, 1)}
          >
            <ShoppingCart className="h-4 w-4" />
            {isSoldOut ? 'Sold Out' : 'Reserve 1 Unit'}
          </Button>
        </div>
      )}

      {/* RESERVING */}
      {state.status === 'reserving' && (
        <Button className="w-full" disabled>
          <Spinner />
          Securing your spot…
        </Button>
      )}

      {/* RESERVED — show countdown + checkout */}
      {(state.status === 'reserved' || state.status === 'checking-out') && (
        <div className="space-y-4">
          <CountdownTimer
            minutes={minutes}
            seconds={seconds}
            progress={progress}
          />

          <div className="rounded-lg bg-zinc-800/50 p-3 text-sm text-zinc-300">
            <span className="font-medium text-white">Reserved:</span>{' '}
            {state.data.quantity} × {product.name}
          </div>

          {/* Inline checkout error — stays in reserved state so user can retry */}
          {state.status === 'reserved' && state.checkoutError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-950/50 border border-red-800 p-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{state.checkoutError}</span>
            </div>
          )}

          <Button
            className="w-full"
            disabled={state.status === 'checking-out'}
            onClick={() => void completeCheckout()}
          >
            {state.status === 'checking-out' ? (
              <>
                <Spinner />
                Processing checkout…
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Complete Checkout — ${(product.price * state.data.quantity).toFixed(2)}
              </>
            )}
          </Button>
        </div>
      )}

      {/* COMPLETED */}
      {state.status === 'completed' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-green-950/50 border border-green-800 p-4">
            <CheckCircle className="h-6 w-6 text-green-400 shrink-0" />
            <div>
              <p className="font-semibold text-green-300">Order confirmed!</p>
              <p className="text-sm text-green-500">
                Total: ${state.order.totalPrice.toFixed(2)} · Order #{state.order.orderId.slice(0, 8)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* EXPIRED */}
      {state.status === 'expired' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-zinc-800 border border-zinc-700 p-3 text-sm text-zinc-400">
            <XCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>Your reservation expired. Stock has been released.</span>
          </div>
          <Button
            variant="outline"
            className="w-full"
            disabled={isSoldOut}
            onClick={reset}
          >
            <RotateCcw className="h-4 w-4" />
            {isSoldOut ? 'Sold Out' : 'Try Again'}
          </Button>
        </div>
      )}

      {/* Sold-out label when in non-idle states */}
      {isSoldOut && state.status === 'idle' && (
        <p className={cn('text-center text-sm text-zinc-500')}>
          Check back soon — stock may be restocked.
        </p>
      )}
    </div>
  );
}
