import type { Request, Response } from 'express';
import type { BuildClientesFinalesUseCase } from '../application/build-clientes-finales.use-case.js';
import type { EnrichClientesFinalesRuesUseCase } from '../application/enrich-clientes-finales-rues.use-case.js';
import type { PipelineCaseRepository } from '../../../core/pipeline/domain/pipeline-case.repository.js';
import { normalizeLeadId } from '../../../core/pipeline/domain/normalize-lead-id.js';
import type { ClientesFinalesRepository } from '../domain/repositories.js';

const MAX_SEARCH_LENGTH = 100;

function parsePagination(req: Request): { page: number; limit: number; search?: string } | null {
  const hasPage = req.query.page !== undefined;
  const hasLimit = req.query.limit !== undefined;
  const hasSearch = typeof req.query.q === 'string' && req.query.q.trim().length > 0;

  if (!hasPage && !hasLimit && !hasSearch) {
    return null;
  }

  const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? '10'), 10) || 10));
  const rawSearch = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const search = rawSearch ? rawSearch.slice(0, MAX_SEARCH_LENGTH) : undefined;

  return { page, limit, search };
}

export class FileMatchingController {
  constructor(
    private readonly buildClientesFinales: BuildClientesFinalesUseCase,
    private readonly clientesFinalesRepository: ClientesFinalesRepository,
    private readonly clientesFinalesSinPagareRepository: ClientesFinalesRepository,
    private readonly enrichClientesFinalesRues: EnrichClientesFinalesRuesUseCase,
    private readonly pipelineCases: PipelineCaseRepository,
  ) {}

  /** Ejecuta ambas validaciones del cruce; responde solo conteos (sin datos de clientes). */
  async run(_req: Request, res: Response): Promise<void> {
    const resumen = await this.buildClientesFinales.execute();
    res.json({ resumen });
  }

  /** Re-consulta RUES (Croma) para todos los clientes_finales; responde solo conteos. */
  async enrichRues(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as { limit?: unknown };
    const limit =
      typeof body.limit === 'number' && Number.isInteger(body.limit) && body.limit > 0
        ? body.limit
        : undefined;

    const resumen = await this.enrichClientesFinalesRues.execute({ limit });
    res.json({ resumen });
  }

  /** Lista de la validación completa (4 condiciones). */
  async listClientesFinales(req: Request, res: Response): Promise<void> {
    const pagination = parsePagination(req);
    if (pagination) {
      const result = await this.clientesFinalesRepository.findPage(pagination);
      const pipelineCases = await this.pipelineCases
        .findByLeadIds(result.clientes.map((cliente) => cliente.clienteId))
        .catch(() => new Map());

      const clientes = result.clientes.map((cliente) => ({
        ...cliente,
        pipelineCase:
          pipelineCases.get(cliente.clienteId) ??
          pipelineCases.get(normalizeLeadId(cliente.clienteId)) ??
          null,
      }));

      res.json({ ...result, clientes });
      return;
    }

    const clientes = await this.clientesFinalesRepository.findAll();
    res.json({ total: clientes.length, clientes });
  }

  /** Lista de la validación sin la condición de pagaré activo. */
  async listClientesFinalesSinPagare(req: Request, res: Response): Promise<void> {
    const pagination = parsePagination(req);
    if (pagination) {
      const result = await this.clientesFinalesSinPagareRepository.findPage(pagination);
      res.json(result);
      return;
    }

    const clientes = await this.clientesFinalesSinPagareRepository.findAll();
    res.json({ total: clientes.length, clientes });
  }

  /** Detalle de un cliente final por identificación (NIT / cliente_id). */
  async getClienteFinalById(req: Request, res: Response): Promise<void> {
    const clienteId = String(req.params.clienteId ?? '').trim();
    if (!clienteId) {
      res.status(400).json({ error: 'clienteId requerido' });
      return;
    }

    const cliente = await this.clientesFinalesRepository.findByClienteId(clienteId);
    if (!cliente) {
      res.status(404).json({ error: 'Cliente no encontrado' });
      return;
    }

    let pipelineCase = null;
    try {
      pipelineCase = await this.pipelineCases.findByLeadId(clienteId);
    } catch {
      pipelineCase = null;
    }

    res.json({
      cliente,
      ...(pipelineCase ? { pipelineCase } : {}),
    });
  }
}
