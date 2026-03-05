import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { PrismaCaseRepository } from "../src/repositories/prismaCaseRepository";

function makeCaseRecord(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "case-1",
    userId: "user-1",
    vertical: "scope-shield",
    channel: "email",
    rawInput: "raw input",
    summary: "summary",
    confidence: 0.82,
    entities: [],
    signals: ["scope-creep-detected"],
    metrics: { originalBudget: 3000 },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    tasks: [
      {
        id: "task-1",
        title: "Task",
        owner: "You",
        dueInDays: 1,
        priority: "high",
        status: "open",
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      }
    ],
    actions: [
      {
        id: "action-1",
        type: "change_order_email",
        title: "Action",
        description: "Desc",
        draft: "Draft",
        requiresApproval: true,
        status: "proposed",
        executedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      }
    ],
    ...overrides
  };
}

describe("PrismaCaseRepository", () => {
  const caseCreate = vi.fn();
  const caseFindMany = vi.fn();
  const caseFindFirst = vi.fn();
  const caseUpdate = vi.fn();
  const actionFindFirst = vi.fn();
  const actionUpdate = vi.fn();

  const prisma: {
    case: {
      create: typeof caseCreate;
      findMany: typeof caseFindMany;
      findFirst: typeof caseFindFirst;
      update: typeof caseUpdate;
    };
    action: {
      findFirst: typeof actionFindFirst;
      update: typeof actionUpdate;
    };
  } = {
    case: {
      create: caseCreate,
      findMany: caseFindMany,
      findFirst: caseFindFirst,
      update: caseUpdate
    },
    action: {
      findFirst: actionFindFirst,
      update: actionUpdate
    }
  };

  beforeEach(() => {
    caseCreate.mockReset();
    caseFindMany.mockReset();
    caseFindFirst.mockReset();
    caseUpdate.mockReset();
    actionFindFirst.mockReset();
    actionUpdate.mockReset();
  });

  it("creates a case and maps relation records", async () => {
    caseCreate.mockResolvedValue(makeCaseRecord());

    const repo = new PrismaCaseRepository(prisma as unknown as PrismaClient);
    const created = await repo.create("user-1", {
      vertical: "scope-shield",
      channel: "email",
      rawInput: "raw input",
      structured: {
        vertical: "scope-shield",
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
          type: "change_order_email",
          title: "Action",
          description: "Desc",
          draft: "Draft",
          requiresApproval: true,
          status: "proposed"
        }
      ]
    });

    expect(caseCreate).toHaveBeenCalledTimes(1);
    expect(created.id).toBe("case-1");
    expect(created.tasks).toHaveLength(1);
    expect(created.actions).toHaveLength(1);
  });

  it("lists and fetches cases by id", async () => {
    caseFindMany.mockResolvedValue([makeCaseRecord(), makeCaseRecord({ id: "case-2" })]);
    caseFindFirst.mockResolvedValue(makeCaseRecord());

    const repo = new PrismaCaseRepository(prisma as unknown as PrismaClient);
    const list = await repo.list("user-1");
    expect(list).toHaveLength(2);

    const byId = await repo.getById("user-1", "case-1");
    expect(byId?.id).toBe("case-1");

    caseFindFirst.mockResolvedValueOnce(null);
    const missing = await repo.getById("user-1", "missing");
    expect(missing).toBeUndefined();
  });

  it("marks action executed and returns undefined when action is not found", async () => {
    actionFindFirst.mockResolvedValueOnce(null);
    const repo = new PrismaCaseRepository(prisma as unknown as PrismaClient);

    const missing = await repo.markActionExecuted("user-1", "case-1", "action-1");
    expect(missing).toBeUndefined();

    actionFindFirst.mockResolvedValueOnce({ id: "action-1", caseId: "case-1" });
    actionUpdate.mockResolvedValueOnce({});
    caseUpdate.mockResolvedValueOnce({});
    caseFindFirst.mockResolvedValueOnce(
      makeCaseRecord({
        actions: [
          {
            id: "action-1",
            type: "change_order_email",
            title: "Action",
            description: "Desc",
            draft: "Draft",
            requiresApproval: true,
            status: "executed",
            executedAt: new Date("2026-01-01T01:00:00.000Z"),
            createdAt: new Date("2026-01-01T00:00:00.000Z")
          }
        ]
      })
    );

    const updated = await repo.markActionExecuted("user-1", "case-1", "action-1");
    expect(actionUpdate).toHaveBeenCalledTimes(1);
    expect(updated?.actions[0].status).toBe("executed");
    expect(updated?.actions[0].executedAt).toBeTruthy();
  });
});
