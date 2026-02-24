import { Router } from 'express';
import { healthRouter } from './health';
import { metricsRouter } from './metrics';
import { reservationsRouter } from './reservations';
import { checkoutRouter } from './checkout';
// import { productsRouter } from './products';   // added in Step 7

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/metrics', metricsRouter);
apiRouter.use('/reservations', reservationsRouter);
apiRouter.use('/checkout', checkoutRouter);
