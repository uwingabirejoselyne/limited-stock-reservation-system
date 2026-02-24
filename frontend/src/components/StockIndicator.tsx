import { cn } from '@/lib/utils';

interface StockIndicatorProps {
  stock: number;
  totalStock: number;
}

export function StockIndicator({ stock, totalStock }: StockIndicatorProps) {
  const pct = totalStock > 0 ? (stock / totalStock) * 100 : 0;

  const barColor =
    pct > 40 ? 'bg-green-500' : pct > 15 ? 'bg-amber-500' : 'bg-red-500';

  const textColor =
    pct > 40
      ? 'text-green-400'
      : pct > 15
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className={cn('font-medium', textColor)}>
          {stock === 0 ? 'Sold out' : `${stock} of ${totalStock} remaining`}
        </span>
        <span className="text-zinc-500">{Math.round(pct)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-1000', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
