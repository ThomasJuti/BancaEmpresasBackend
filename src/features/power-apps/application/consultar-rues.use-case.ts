import { crossCheckPowerAppWithRues } from '../domain/rues-cross-check.js';
import type { PowerAppFormSnapshot, RuesConsultarResponse } from '../domain/rues-consultation.js';
import type { ValidationIssue } from '../domain/validation-issue.js';
import type { RuesHttpClient } from '../infrastructure/rues-http.client.js';

export interface ConsultarRuesInput {
  nit: string;
  form?: PowerAppFormSnapshot;
  headed?: boolean;
  useMock?: boolean;
}

export interface ConsultarRuesOutput extends RuesConsultarResponse {
  issues: ValidationIssue[];
}

export async function consultarRuesUseCase(
  client: RuesHttpClient,
  input: ConsultarRuesInput,
): Promise<ConsultarRuesOutput> {
  const response = await client.consultar(input.nit, {
    headed: input.headed,
    mock: input.useMock,
  });

  const issues = input.form
    ? crossCheckPowerAppWithRues(input.form, response.consultation)
    : [];

  return {
    ...response,
    issues,
  };
}
