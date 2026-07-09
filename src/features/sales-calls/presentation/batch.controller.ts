import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../../infrastructure/config/env.js';
import { NotFoundError, ValidationError } from '../../../shared/exceptions/app-error.js';
import type { PacingPolicy } from '../domain/CallBatch.js';
import type { SalesCallsDeps } from '../infrastructure/composition.js';

const businessHoursSchema = z
  .object({
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
  })
  .refine((b) => b.endHour > b.startHour, {
    message: 'businessHours.endHour debe ser mayor que startHour',
  });

const pacingSchema = z
  .object({
    maxConcurrent: z.number().int().positive().max(500).optional(),
    perHour: z.number().int().positive().max(100000).optional(),
    earliestAt: z.string().datetime().optional(),
    latestAt: z.string().datetime().optional(),
    businessHours: businessHoursSchema.optional(),
    timezone: z.string().min(1).max(64).optional(),
  })
  .refine((p) => !p.earliestAt || !p.latestAt || new Date(p.earliestAt) < new Date(p.latestAt), {
    message: 'pacing.earliestAt debe ser anterior a latestAt',
  });

const leadSchema = z.object({
  leadId: z.string().trim().min(1).max(120),
  phoneNumber: z
    .string()
    .regex(/^\+\d{8,15}$/, 'phoneNumber debe estar en formato E.164, ej. +573001234567'),
  customerName: z.string().max(200).optional(),
  customerEmail: z.email().optional(),
  variables: z.record(z.string(), z.string()).optional(),
});

const createBatchSchema = z.object({
  name: z.string().trim().min(1).max(200),
  agentId: z.string().trim().min(1).max(120).optional(),
  leads: z.array(leadSchema).min(1).max(5000),
  pacing: pacingSchema.optional(),
  defaultVariables: z.record(z.string(), z.string()).optional(),
});

const actionSchema = z.enum(['pause', 'resume', 'cancel']);

/** Endpoints de campaña (batch calling) sobre sales-calls. */
export class BatchController {
  constructor(private readonly deps: SalesCallsDeps) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createBatchSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
      }

      const pacing: PacingPolicy = {
        maxConcurrent: parsed.data.pacing?.maxConcurrent ?? env.callBatch.maxConcurrent,
        perHour: parsed.data.pacing?.perHour ?? env.callBatch.perHour,
        earliestAt: parsed.data.pacing?.earliestAt,
        latestAt: parsed.data.pacing?.latestAt,
        businessHours: parsed.data.pacing?.businessHours ?? env.callBatch.businessHours,
        timezone: parsed.data.pacing?.timezone ?? env.callBatch.timezone,
      };

      const batch = await this.deps.createBatch.execute({
        name: parsed.data.name,
        agentId: parsed.data.agentId,
        leads: parsed.data.leads,
        pacing,
        defaultVariables: parsed.data.defaultVariables,
      });

      res.status(201).json(batch);
    } catch (error) {
      next(error);
    }
  };

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await this.deps.listBatches.execute());
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const progress = await this.deps.getBatch.execute(String(req.params.id));
      if (!progress) throw new NotFoundError('Campaña no encontrada');
      res.json(progress);
    } catch (error) {
      next(error);
    }
  };

  items = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const batch = await this.deps.getBatch.execute(String(req.params.id));
      if (!batch) throw new NotFoundError('Campaña no encontrada');
      res.json(await this.deps.listBatchItems.execute(String(req.params.id)));
    } catch (error) {
      next(error);
    }
  };

  setStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const action = actionSchema.safeParse(String(req.params.action));
      if (!action.success) {
        throw new ValidationError('action debe ser pause, resume o cancel');
      }
      const batch = await this.deps.setBatchStatus.execute(String(req.params.id), action.data);
      res.json(batch);
    } catch (error) {
      next(error);
    }
  };

  handoff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const prefill = await this.deps.buildPrefill.execute(String(req.params.id));
      if (!prefill) {
        throw new NotFoundError('La llamada no existe o no está calificada para handoff');
      }
      res.json(prefill);
    } catch (error) {
      next(error);
    }
  };

  dispatch = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.deps.dispatchBatches.execute();
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
