import { Router } from 'express';
import { healthRouter } from './health';
import { metricsRouter } from './metrics';
// Feature routes will be added here as we build each step
// import { productsRouter } from './products';
// import { reservationsRouter } from './reservations';
// import { checkoutRouter } from './checkout';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/metrics', metricsRouter);
