import type { Request, Response } from 'express';
import type { BuildClientesFinalesUseCase } from '../application/build-clientes-finales.use-case.js';
import type { ClientesFinalesRepository } from '../domain/repositories.js';

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
  async listClientesFinales(_req: Request, res: Response): Promise<void> {
    const clientes = await this.clientesFinalesRepository.findAll();
    res.json({ total: clientes.length, clientes });
  }

  /** Lista de la validación sin la condición de pagaré activo. */
  async listClientesFinalesSinPagare(_req: Request, res: Response): Promise<void> {
    const clientes = await this.clientesFinalesSinPagareRepository.findAll();
    res.json({ total: clientes.length, clientes });
  }
}
