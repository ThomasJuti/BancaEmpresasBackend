import type { FollowUpCaseView } from '../domain/entities.js';
import { buildFollowUpView } from '../domain/follow-up-policy.js';
import type { FollowUpCaseRepository } from '../domain/repository.js';

/** Lista los casos de seguimiento con los campos calculados para la UI. */
export class ListFollowUpCasesUseCase {
  constructor(
    private readonly repository: FollowUpCaseRepository,
    private readonly dayMs: number,
  ) {}

  async execute(): Promise<FollowUpCaseView[]> {
    const now = new Date();
    const casos = await this.repository.findAll();
    return casos
      .map((caso) => buildFollowUpView(caso, now, this.dayMs))
      .sort((a, b) => b.diasSinUso - a.diasSinUso);
  }
}
