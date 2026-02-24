import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  minutes: number;
  seconds: number;
  progress: number;
}

export function CountdownTimer({ minutes, seconds, progress }: CountdownTimerProps) {
  const isUrgent = progress < 40; // < 2 min
  const isCritical = progress < 10; // < 30 s

  const timeColor = isCritical
    ? 'text-red-400'
    : isUrgent
      ? 'text-amber-400'
      : 'text-blue-400';

  const barClass = isCritical
    ? '[&>div]:bg-red-500'
    : isUrgent
      ? '[&>div]:bg-amber-500'
      : '[&>div]:bg-blue-500';

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="space-y-2 p-4 rounded-lg bg-zinc-900 border border-zinc-800">
      <div className="flex items-center gap-2">
        <Clock
          className={cn('h-4 w-4', timeColor, isCritical && 'animate-pulse')}
        />
        <span className="text-sm text-zinc-400">Reservation expires in</span>
      </div>

      <p className={cn('text-3xl font-mono font-bold tracking-widest', timeColor)}>
        {pad(minutes)}:{pad(seconds)}
      </p>

      <Progress value={progress} className={cn('h-1.5', barClass)} />
    </div>
  );
}
