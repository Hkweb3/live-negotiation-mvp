import { describe, expect, it } from "vitest";
import {
  HeuristicNegotiationEngine,
  OpenAINegotiationEngine
} from "../src/services/negotiationEngine";
import { appConfig } from "../src/config";

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

  it("openai engine uses llm branch when client returns valid JSON", async () => {
    const previousKey = appConfig.openAiApiKey;
    appConfig.openAiApiKey = "test-openai-key";

    const engine = new OpenAINegotiationEngine() as unknown as {
      analyze: OpenAINegotiationEngine["analyze"];
      client: {
        chat: {
          completions: {
            create: (input: unknown) => Promise<{
              choices: Array<{ message: { content: string } }>;
            }>;
          };
        };
      };
    };

    engine.client = {
      chat: {
        completions: {
          create: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: "LLM summary",
                    confidence: 0.91,
                    signals: ["high-fee-risk"],
                    entities: [
                      {
                        key: "apr",
                        value: "9.4",
                        confidence: 0.9,
                        source: "APR 9.4%"
                      }
                    ],
                    metrics: {
                      apr: 9.4,
                      suspiciousFeesTotal: 2198
                    },
                    tasks: [
                      {
                        title: "Request itemized OTD quote",
                        owner: "You",
                        dueInDays: 1,
                        priority: "high"
                      }
                    ],
                    actions: [
                      {
                        type: "dealer_counteroffer_email",
                        title: "Counteroffer",
                        description: "Send counteroffer email",
                        draft: "Draft email body",
                        requiresApproval: true
                      }
                    ]
                  })
                }
              }
            ]
          })
        }
      }
    };

    const result = await engine.analyze(requestPayload);
    expect(result.source).toBe("llm");
    expect(result.actions).toHaveLength(1);
    expect(result.tasks).toHaveLength(1);

    appConfig.openAiApiKey = previousKey;
  });
});
