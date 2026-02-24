import { Router } from 'express';
import { healthRouter } from './health';
import { metricsRouter } from './metrics';
import { reservationsRouter } from './reservations';
// import { productsRouter } from './products';   // added in Step 7
// import { checkoutRouter } from './checkout';   // added in Step 5

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/metrics', metricsRouter);
apiRouter.use('/reservations', reservationsRouter);
