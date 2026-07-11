import { randomUUID } from 'node:crypto';
import type { Call } from '../domain/Call.js';
import type { CallRepository } from '../domain/CallRepository.js';
import type { FonemaGateway } from '../domain/FonemaGateway.js';

export interface InitiateCallRequest {
  phoneNumber: string;
  customerName?: string;
  customerEmail?: string;
  script?: string;
  variables?: Record<string, string>;
  delaySeconds?: number;
  /** Caso del pipeline; se persiste en la llamada para el auto-avance a power_apps. */
  caseId?: string;
}

export class InitiateCallUseCase {
  constructor(
    private readonly fonemaGateway: FonemaGateway,
    private readonly callRepository: CallRepository,
    private readonly defaultAgentId: string,
  ) {}

  async execute(request: InitiateCallRequest): Promise<Call> {
    const variableValues = { ...request.variables };
    if (request.script) {
      variableValues.script = request.script;
    }

    const result = await this.fonemaGateway.initiateCall({
      agentId: this.defaultAgentId,
      phoneNumber: request.phoneNumber,
      customerName: request.customerName,
      customerEmail: request.customerEmail,
      variableValues,
      delaySeconds: request.delaySeconds,
    });

    const now = new Date().toISOString();
    const call: Call = {
      id: randomUUID(),
      sessionId: result.sessionId,
      caseId: request.caseId,
      agentId: this.defaultAgentId,
      phoneNumber: request.phoneNumber,
      customerName: request.customerName,
      customerEmail: request.customerEmail,
      script: request.script,
      variables: variableValues,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
    };

    await this.callRepository.save(call);
    return call;
  }
}
