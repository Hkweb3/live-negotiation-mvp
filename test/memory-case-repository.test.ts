import { describe, expect, it } from "vitest";
import { InMemoryCaseRepository } from "../src/repositories/memoryCaseRepository";
import { CreateCaseInput } from "../src/repositories/interfaces";

function createInput(vertical: "scope-shield" | "deal-pilot"): CreateCaseInput {
  return {
    vertical,
    channel: "email",
    rawInput: "raw input",
    structured: {
      vertical,
      summary: "summary",
      entities: [],
      signals: [],
      metrics: {},
      confidence: 0.8
    },
    tasks: [
      {
        id: "task-1",
        title: "Task",
        owner: "You",
        dueInDays: 1,
        priority: "high",
        status: "open"
      }
    ],
    actions: [
      {
        id: "action-1",
        type: vertical === "scope-shield" ? "change_order_email" : "dealer_counteroffer_email",
        title: "Action",
        description: "Action description",
        draft: "Action draft",
        requiresApproval: true,
        status: "proposed"
      }
    ]
  };
}

describe("InMemoryCaseRepository", () => {
  it("creates, lists, and fetches cases scoped by user", async () => {
    const repo = new InMemoryCaseRepository();

    const a = await repo.create("user-a", createInput("scope-shield"));
    const b = await repo.create("user-a", createInput("deal-pilot"));
    await repo.create("user-b", createInput("scope-shield"));

    const userACases = await repo.list("user-a");
    expect(userACases).toHaveLength(2);

    const onlyDealPilot = await repo.list("user-a", "deal-pilot");
    expect(onlyDealPilot).toHaveLength(1);
    expect(onlyDealPilot[0].id).toBe(b.id);

    const fetched = await repo.getById("user-a", a.id);
    expect(fetched?.id).toBe(a.id);

    const crossUser = await repo.getById("user-b", a.id);
    expect(crossUser).toBeUndefined();
  });

  it("marks an action executed and returns undefined for missing action", async () => {
    const repo = new InMemoryCaseRepository();
    const created = await repo.create("user-a", createInput("scope-shield"));

    const missing = await repo.markActionExecuted("user-a", created.id, "missing-action");
    expect(missing).toBeUndefined();

    const updated = await repo.markActionExecuted("user-a", created.id, "action-1");
    expect(updated).toBeDefined();
    expect(updated?.actions[0].status).toBe("executed");
    expect(updated?.actions[0].executedAt).toBeTruthy();
  });
});
