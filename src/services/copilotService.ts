import { IngestionRequest, Vertical } from "../types";
import { CaseRepository } from "../repositories/interfaces";
import { NegotiationEngine } from "./negotiationEngine";

export class CopilotService {
  constructor(
    private readonly caseRepository: CaseRepository,
    private readonly negotiationEngine: NegotiationEngine
  ) {}

  async ingest(userId: string, request: IngestionRequest) {
    const result = await this.negotiationEngine.analyze(request);

    return this.caseRepository.create(userId, {
      vertical: request.vertical,
      channel: request.channel,
      rawInput: request.content,
      structured: result.structured,
      tasks: result.tasks,
      actions: result.actions
    });
  }

  async listCases(userId: string, vertical?: Vertical) {
    return this.caseRepository.list(userId, vertical);
  }

  async getCaseById(userId: string, caseId: string) {
    return this.caseRepository.getById(userId, caseId);
  }

  async executeAction(userId: string, caseId: string, actionId: string) {
    return this.caseRepository.markActionExecuted(userId, caseId, actionId);
  }
}
