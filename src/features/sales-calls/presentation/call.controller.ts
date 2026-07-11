import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '../../../shared/exceptions/app-error.js';
import type { GetCallRecordingUseCase } from '../application/GetCallRecordingUseCase.js';
import type { GetCallUseCase } from '../application/GetCallUseCase.js';
import type { HandleCallWebhookUseCase } from '../application/HandleCallWebhookUseCase.js';
import type { InitiateCallUseCase } from '../application/InitiateCallUseCase.js';
import type { ListCallsUseCase } from '../application/ListCallsUseCase.js';
import type { RegisterManualCallUseCase } from '../application/RegisterManualCallUseCase.js';

const initiateCallSchema = z.object({
  caseId: z.string().uuid().optional(),
  phoneNumber: z.string().regex(/^\+\d{8,15}$/, 'phoneNumber debe estar en formato E.164, ej. +573001234567'),
  customerName: z.string().max(200).optional(),
  customerEmail: z.email().optional(),
  script: z.string().max(5000).optional(),
  variables: z.record(z.string(), z.string()).optional(),
  delaySeconds: z.number().int().min(0).max(3600).optional(),
});

const manualCallSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^\+\d{8,15}$/, 'phoneNumber debe estar en formato E.164, ej. +573001234567')
    .optional(),
  customerName: z.string().trim().min(1, 'El nombre del contacto es obligatorio'),
  customerEmail: z.email().optional(),
  variables: z.object({
    empresa: z.string().trim().min(1, 'El nombre de la empresa es obligatorio'),
    nit: z.string().trim().min(1, 'El NIT es obligatorio'),
  }),
  identidadVerificada: z.boolean(),
  clienteInteresado: z.boolean(),
  motivoNoInteres: z.string().max(500).optional(),
  summary: z.string().max(2000).optional(),
  durationSeconds: z.number().int().min(0).max(7200).optional(),
});

export class CallController {
  constructor(
    private readonly initiateCallUseCase: InitiateCallUseCase,
    private readonly getCallUseCase: GetCallUseCase,
    private readonly listCallsUseCase: ListCallsUseCase,
    private readonly registerManualCallUseCase: RegisterManualCallUseCase,
    private readonly getCallRecordingUseCase: GetCallRecordingUseCase,
    private readonly handleCallWebhookUseCase: HandleCallWebhookUseCase,
  ) {}

  initiate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = initiateCallSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
      }
      const call = await this.initiateCallUseCase.execute(parsed.data);
      res.status(202).json(call);
    } catch (error) {
      next(error);
    }
  };

  registerManual = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = manualCallSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
      }
      const call = await this.registerManualCallUseCase.execute(parsed.data);
      res.status(201).json(call);
    } catch (error) {
      next(error);
    }
  };

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const calls = await this.listCallsUseCase.execute();
      res.json(calls);
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const call = await this.getCallUseCase.execute(String(req.params.id));
      if (!call) {
        throw new NotFoundError('Llamada no encontrada');
      }
      res.json(call);
    } catch (error) {
      next(error);
    }
  };

  recording = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const recording = await this.getCallRecordingUseCase.execute(String(req.params.id));
      if (!recording) {
        throw new NotFoundError('Grabación no disponible');
      }

      const { data, contentType } = recording;
      const total = data.length;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      // Permite que el frontend (otro origen) embeba el audio; sobreescribe
      // el Cross-Origin-Resource-Policy: same-origin que aplica helmet.
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      // Soporte de HTTP Range: permite al reproductor saltar/adelantar
      // (el navegador pide "bytes=inicio-fin" y espera 206 Partial Content).
      const range = req.headers.range;
      if (range) {
        const match = /bytes=(\d*)-(\d*)/.exec(range);
        const start = match && match[1] ? parseInt(match[1], 10) : 0;
        const end = match && match[2] ? parseInt(match[2], 10) : total - 1;

        if (start >= total || end >= total || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${total}`);
          res.end();
          return;
        }

        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', end - start + 1);
        res.end(data.subarray(start, end + 1));
        return;
      }

      res.setHeader('Content-Length', total);
      res.end(data);
    } catch (error) {
      next(error);
    }
  };

  callUpdateWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.handleCallWebhookUseCase.handleCallUpdate(req.body);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  endOfCallWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.handleCallWebhookUseCase.handleEndOfCall(req.body);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  endOfSessionWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.handleCallWebhookUseCase.handleEndOfSession(req.body);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
