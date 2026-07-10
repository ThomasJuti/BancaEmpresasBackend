import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../../infrastructure/config/env.js';
import { consultarRuesUseCase } from '../application/consultar-rues.use-case.js';
import { RuesHttpClient } from '../infrastructure/rues-http.client.js';

const consultarSchema = z.object({
  nit: z.string().trim().min(1),
  headed: z.boolean().optional(),
  form: z
    .object({
      identificacionEmpresa: z.string().trim().optional(),
      nombreEmpresa: z.string().trim().optional(),
      numeroIdentificacionTarjetahabiente: z.string().trim().optional(),
      nombreTarjetahabiente: z.string().trim().optional(),
      ciudadPuntoEntrega: z.string().trim().optional(),
    })
    .optional(),
});

const ruesClient = new RuesHttpClient();

export async function ruesHealthHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!env.rues.enabled) {
      res.status(503).json({ enabled: false, message: 'Consulta RUES deshabilitada en este entorno.' });
      return;
    }
    const health = await ruesClient.health();
    res.json({ enabled: true, ...health });
  } catch (error) {
    next(error);
  }
}

export async function consultarRuesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!env.rues.enabled) {
      res.status(503).json({
        error: 'Consulta RUES deshabilitada. Use carga manual de PDF con advertencia.',
      });
      return;
    }

    const parsed = consultarSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Payload inválido', issues: parsed.error.issues });
      return;
    }

    const result = await consultarRuesUseCase(ruesClient, {
      nit: parsed.data.nit,
      form: parsed.data.form,
      headed: parsed.data.headed,
      useMock: env.rues.mockEnabled,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}
