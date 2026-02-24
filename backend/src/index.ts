import 'dotenv/config';
import { config } from './lib/config';
import { logger } from './utils/logger';

async function bootstrap() {
  // App and routes will be wired up in the next step
  const { app } = await import('./app');

  app.listen(config.port, () => {
    logger.info(
      `Server running on port ${config.port} [${config.nodeEnv}]`
    );
  });
}

bootstrap().catch((err) => {
  logger.error('Fatal error during bootstrap', err);
  process.exit(1);
});
