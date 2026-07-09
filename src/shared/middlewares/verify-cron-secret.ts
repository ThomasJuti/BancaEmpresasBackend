import type { NextFunction, Request, Response } from 'express';
import { env } from '../../infrastructure/config/env.js';

/**
 * Protege endpoints invocados por Vercel Cron (Authorization: Bearer CRON_SECRET).
 * En local, si CRON_SECRET no está definido, permite el acceso para pruebas.
 */
export function verifyCronSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = env.cron.secret;

  if (!secret) {
    if (env.nodeEnv === 'production') {
      res.status(503).json({
        error: { code: 'CRON_NOT_CONFIGURED', message: 'CRON_SECRET is not configured' },
      });
      return;
    }
    next();
    return;
  }

  const auth = req.headers.authorization;
  if (auth !== `Bearer ${secret}`) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' } });
    return;
  }

  next();
}
