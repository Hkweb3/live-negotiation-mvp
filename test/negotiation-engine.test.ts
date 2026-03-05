import { describe, expect, it } from "vitest";
import {
  HeuristicNegotiationEngine,
  OpenAINegotiationEngine
} from "../src/services/negotiationEngine";

const requestPayload = {
  vertical: "deal-pilot" as const,
  channel: "text" as const,
  content:
    "Out-the-door price $32500, APR 9.4%, 72 months, doc fee $899 and protection package $1299",
  context: {
    customerName: "Jamie",
    counterparty: "Dealer"
  }
};

describe("negotiation engines", () => {
  it("heuristic engine produces structured result with tasks/actions", async () => {
    const engine = new HeuristicNegotiationEngine();
    const result = await engine.analyze(requestPayload);

    expect(result.source).toBe("heuristic");
    expect(result.structured.summary.length).toBeGreaterThan(5);
    expect(result.tasks.length).toBeGreaterThan(0);
    expect(result.actions.length).toBeGreaterThan(0);
  });

  it("openai engine falls back to heuristic when API key is not configured", async () => {
    const engine = new OpenAINegotiationEngine();
    const result = await engine.analyze(requestPayload);

    expect(result.source).toBe("heuristic");
    expect(result.actions.some((action) => action.type === "dealer_counteroffer_email")).toBe(
      true
    );
  });
});
