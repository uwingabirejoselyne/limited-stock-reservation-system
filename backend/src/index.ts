import 'dotenv/config';
import { config } from './lib/config';
import { logger } from './utils/logger';
import { startScheduler } from './jobs/scheduler';

async function bootstrap() {
  const { app } = await import('./app');

  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} [${config.nodeEnv}]`);
  });

  // Start the background job that expires stale reservations
  startScheduler();
}

bootstrap().catch((err) => {
  logger.error('Fatal error during bootstrap', err);
  process.exit(1);
});
