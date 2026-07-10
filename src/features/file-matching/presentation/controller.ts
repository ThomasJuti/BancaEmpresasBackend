import type { Request, Response } from 'express';
import type { BuildClientesFinalesUseCase } from '../application/build-clientes-finales.use-case.js';
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
  ) {}

  /** Ejecuta ambas validaciones del cruce; responde solo conteos (sin datos de clientes). */
  async run(_req: Request, res: Response): Promise<void> {
    const resumen = await this.buildClientesFinales.execute();
    res.json({ resumen });
  }

  /** Lista de la validación completa (4 condiciones). */
  async listClientesFinales(req: Request, res: Response): Promise<void> {
    const pagination = parsePagination(req);
    if (pagination) {
      const result = await this.clientesFinalesRepository.findPage(pagination);
      res.json(result);
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

    res.json({ cliente });
  }
}
