import rateLimit from 'express-rate-limit';
import { config } from '../lib/config';
import type { ApiResponse } from '../types';

export const globalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    const body: ApiResponse = {
      success: false,
      error: 'Too many requests, please slow down.',
    };
    res.status(429).json(body);
  },
});

// Tighter limit for mutating reservation endpoints
export const reserveRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    const body: ApiResponse = {
      success: false,
      error: 'Too many reservation attempts, please wait a moment.',
    };
    res.status(429).json(body);
  },
});
