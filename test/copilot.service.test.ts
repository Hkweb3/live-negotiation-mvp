import { describe, expect, it, vi } from "vitest";
import { CopilotService } from "../src/services/copilotService";
import { CaseRepository } from "../src/repositories/interfaces";
import { NegotiationEngine } from "../src/services/negotiationEngine";
import { IngestionRequest } from "../src/types";

describe("CopilotService", () => {
  it("delegates ingest/list/get/execute to collaborators", async () => {
    const caseRecord = {
      id: "case-1",
      vertical: "scope-shield" as const,
      channel: "email" as const,
      rawInput: "raw",
      structured: {
        vertical: "scope-shield" as const,
        summary: "sum",
        entities: [],
        signals: [],
        metrics: {},
        confidence: 0.8
      },
      tasks: [],
      actions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const caseRepository: CaseRepository = {
      create: vi.fn(async () => caseRecord),
      list: vi.fn(async () => [caseRecord]),
      getById: vi.fn(async () => caseRecord),
      markActionExecuted: vi.fn(async () => caseRecord)
    };

    const negotiationEngine: NegotiationEngine = {
      analyze: vi.fn(async () => ({
        structured: caseRecord.structured,
        tasks: [],
        actions: [],
        source: "heuristic" as const
      }))
    };

    const service = new CopilotService(caseRepository, negotiationEngine);
    const payload: IngestionRequest = {
      vertical: "scope-shield",
      channel: "email",
      content: "raw"
    };

    const created = await service.ingest("user-1", payload);
    expect(created.id).toBe("case-1");
    expect(caseRepository.create).toHaveBeenCalledTimes(1);
    expect(negotiationEngine.analyze).toHaveBeenCalledWith(payload);

    const listed = await service.listCases("user-1");
    expect(listed).toHaveLength(1);

    const byId = await service.getCaseById("user-1", "case-1");
    expect(byId?.id).toBe("case-1");

    const executed = await service.executeAction("user-1", "case-1", "action-1");
    expect(executed?.id).toBe("case-1");
  });
});
