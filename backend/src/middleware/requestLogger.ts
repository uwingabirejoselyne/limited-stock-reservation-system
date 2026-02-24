import morgan from 'morgan';
import { logger } from '../utils/logger';

// Pipe Morgan's output into Winston so all logs go through one transport
const stream = {
  write: (message: string) => logger.http(message.trimEnd()),
};

// In production use Apache combined; in dev use concise dev format
const format =
  process.env['NODE_ENV'] === 'production'
    ? ':remote-addr :method :url :status :res[content-length] :response-time ms'
    : 'dev';

export const requestLogger = morgan(format, { stream });
