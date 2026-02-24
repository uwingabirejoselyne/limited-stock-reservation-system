import { Zap, RefreshCw, AlertTriangle } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { Spinner } from '@/components/ui/spinner';
import { useProducts } from '@/hooks/useProducts';

export function ProductDropPage() {
  const { products, loading, error } = useProducts({ isActive: true });

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-400" />
            <span className="font-bold text-lg text-zinc-100">Limited Drop</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <RefreshCw className="h-3 w-3" />
            Stock refreshes every 5 s
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8 text-center space-y-2">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-blue-950/60 border border-blue-800 px-3 py-1 text-xs font-medium text-blue-300">
            <Zap className="h-3 w-3" />
            Limited Stock — Reserve before it's gone
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-100">
            Today's Drop
          </h1>
          <p className="text-zinc-400 max-w-md mx-auto">
            Each reservation holds your unit for <strong className="text-zinc-200">5 minutes</strong>.
            Complete checkout before the timer runs out.
          </p>
        </div>

        {/* ── States ──────────────────────────────────────────────────── */}

        {/* Loading skeleton */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-20 text-zinc-500">
            <Spinner className="h-8 w-8" />
            <p className="text-sm">Loading drop…</p>
          </div>
        )}

        {/* Network / API error */}
        {!loading && error && (
          <div className="flex flex-col items-center gap-3 py-20">
            <AlertTriangle className="h-10 w-10 text-amber-400" />
            <p className="text-zinc-300 font-medium">Unable to load products</p>
            <p className="text-sm text-zinc-500">{error}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && products.length === 0 && (
          <div className="py-20 text-center text-zinc-500">
            <p className="text-lg font-medium">No active drops right now.</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        )}

        {/* Product grid */}
        {!loading && !error && products.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 mt-16 py-6 text-center text-xs text-zinc-600">
        Limited Stock Reservation System · All reservations expire after 5 minutes
      </footer>
    </div>
  );
}
