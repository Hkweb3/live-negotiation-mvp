import { describe, expect, it } from "vitest";
import { buildTasksAndActions } from "../src/lib/recommendations";
import { IngestionRequest, StructuredData } from "../src/types";

describe("buildTasksAndActions", () => {
  it("builds scope-shield tasks/actions with change-order messaging", () => {
    const input: IngestionRequest = {
      vertical: "scope-shield",
      channel: "email",
      content: "Client requested extra revisions.",
      context: {
        customerName: "Alex",
        counterparty: "Morgan"
      }
    };

    const structured: StructuredData = {
      vertical: "scope-shield",
      summary: "Potential scope creep detected.",
      entities: [],
      signals: ["scope-creep-detected"],
      metrics: {
        originalBudget: 3200,
        addedRequests: ["Need a new dashboard", "Need revised workflow copy"]
      },
      confidence: 0.8
    };

    const result = buildTasksAndActions(input, structured);

    expect(result.tasks).toHaveLength(3);
    expect(result.actions).toHaveLength(3);
    expect(result.actions.map((action) => action.type)).toContain("change_order_email");
    expect(result.actions[1].draft).toContain("Reply with \"Approved\"");
  });

  it("builds deal-pilot tasks/actions with fee challenge context", () => {
    const input: IngestionRequest = {
      vertical: "deal-pilot",
      channel: "text",
      content: "Dealer quote has doc fee and protection package.",
      context: {
        customerName: "Jamie",
        counterparty: "Dealer Rep"
      }
    };

    const structured: StructuredData = {
      vertical: "deal-pilot",
      summary: "Suspicious fees detected.",
      entities: [],
      signals: ["high-fee-risk"],
      metrics: {
        apr: 9.4,
        otdPrice: 32500,
        suspiciousFeesTotal: 2198,
        suspiciousFeesBreakdown: ["doc fee: $899.00", "protection package: $1299.00"]
      },
      confidence: 0.85
    };

    const result = buildTasksAndActions(input, structured);

    expect(result.tasks).toHaveLength(3);
    expect(result.actions).toHaveLength(3);
    expect(result.actions.map((action) => action.type)).toContain("fee_dispute_script");
    expect(result.actions[0].draft).toContain("OTD");
  });
});
