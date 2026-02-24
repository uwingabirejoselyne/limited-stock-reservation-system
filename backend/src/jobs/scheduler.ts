import { logger } from '../utils/logger';
import { expireReservations } from './expireReservations.job';

const INTERVAL_MS = 60_000; // run every 60 seconds

/**
 * Guards against overlapping runs if a tick takes longer than the interval
 * (e.g. DB is slow and the next tick fires before the previous one finishes).
 */
let isRunning = false;

async function runExpiration() {
  if (isRunning) {
    logger.warn('Expiration job skipped — previous run still in progress');
    return;
  }

  isRunning = true;
  try {
    await expireReservations();
  } catch (err) {
    logger.error('Expiration job crashed unexpectedly', err);
  } finally {
    isRunning = false;
  }
}

export function startScheduler(): void {
  logger.info(
    `Expiration scheduler started (interval: ${INTERVAL_MS / 1000}s)`
  );

  // Run once immediately on startup to catch any reservations that expired
  // while the server was down (e.g. Render free-tier sleep).
  void runExpiration();

  setInterval(() => void runExpiration(), INTERVAL_MS);
}
