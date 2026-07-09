import type { CallRepository } from '../domain/CallRepository.js';
import type { FonemaGateway, FonemaRecording } from '../domain/FonemaGateway.js';

export class GetCallRecordingUseCase {
  constructor(
    private readonly callRepository: CallRepository,
    private readonly fonemaGateway: FonemaGateway,
  ) {}

  async execute(callId: string): Promise<FonemaRecording | null> {
    const call = await this.callRepository.findById(callId);
    if (!call?.recordingUrl) {
      return null;
    }
    return this.fonemaGateway.fetchRecording(call.recordingUrl);
  }
}
