import { join } from 'node:path';
import type { Call } from '../../domain/Call.js';
import type { CallRepository } from '../../domain/CallRepository.js';

// Carga datos de demo en el repositorio cuando SEED_DEMO=true.
// Solo para desarrollo/demo; no debe usarse en producción.
export async function loadSeed(repository: CallRepository): Promise<void> {
  try {
    const { readFileSync } = await import('node:fs');
    const raw = readFileSync(join(import.meta.dirname, 'demo-calls.json'), 'utf-8');
    const calls = JSON.parse(raw) as Call[];
    for (const call of calls) {
      await repository.save(call);
    }
    console.log(`Seed cargado: ${calls.length} llamada(s) de demo`);
  } catch (error) {
    console.warn('No se pudo cargar el seed de demo:', (error as Error).message);
  }
}
