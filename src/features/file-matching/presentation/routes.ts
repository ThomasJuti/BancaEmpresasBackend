import { Router } from 'express';
import { getSupabaseClient } from '../../../infrastructure/database/supabase.js';
import { BuildClientesFinalesUseCase } from '../application/build-clientes-finales.use-case.js';
import { SupabaseBasePotencialRepository } from '../infrastructure/supabase-base-potencial.repository.js';
import { SupabaseCecRepository } from '../infrastructure/supabase-cec.repository.js';
import { SupabaseClientesFinalesRepository } from '../infrastructure/supabase-clientes-finales.repository.js';
import { SupabasePagaresRepository } from '../infrastructure/supabase-pagares.repository.js';
import { FileMatchingController } from './controller.js';

/** Cruce de archivos: base potencial × CEC × pagarés → clientes_finales[_sin_pagare] */
export const fileMatchingRouter = Router();

// Composición perezosa: getSupabaseClient() exige credenciales, y /health debe
// responder aunque Supabase no esté configurado.
let controller: FileMatchingController | null = null;

function getController(): FileMatchingController {
  if (controller) return controller;

  const supabase = getSupabaseClient();
  const clientesFinalesRepository = new SupabaseClientesFinalesRepository(
    supabase,
    'clientes_finales',
  );
  const clientesFinalesSinPagareRepository = new SupabaseClientesFinalesRepository(
    supabase,
    'clientes_finales_sin_pagare',
  );
  const buildClientesFinales = new BuildClientesFinalesUseCase(
    new SupabaseCecRepository(supabase),
    new SupabaseBasePotencialRepository(supabase),
    new SupabasePagaresRepository(supabase),
    clientesFinalesRepository,
    clientesFinalesSinPagareRepository,
  );

  controller = new FileMatchingController(
    buildClientesFinales,
    clientesFinalesRepository,
    clientesFinalesSinPagareRepository,
  );
  return controller;
}

fileMatchingRouter.get('/health', (_req, res) => {
  res.json({
    feature: 'file-matching',
    status: 'ok',
    sources: ['base_potencial', 'cec', 'clientes_potenciales_grabar'],
  });
});

fileMatchingRouter.post('/run', (req, res) => getController().run(req, res));
fileMatchingRouter.get('/clientes-finales', (req, res) =>
  getController().listClientesFinales(req, res),
);
fileMatchingRouter.get('/clientes-finales-sin-pagare', (req, res) =>
  getController().listClientesFinalesSinPagare(req, res),
);
