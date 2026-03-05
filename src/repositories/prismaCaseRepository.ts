import { PrismaClient, Prisma } from "@prisma/client";
import {
  ActionType,
  CaseRecord,
  ExtractedEntity,
  StructuredData,
  SuggestedAction,
  Task,
  Vertical
} from "../types";
import { CaseRepository, CreateCaseInput } from "./interfaces";

const caseInclude = {
  tasks: true,
  actions: true
} satisfies Prisma.CaseInclude;

type PrismaCaseWithRelations = Prisma.CaseGetPayload<{ include: typeof caseInclude }>;

function ensureEntityArray(value: Prisma.JsonValue): ExtractedEntity[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return undefined;
      }

      const raw = item as Record<string, unknown>;
      if (
        typeof raw.key !== "string" ||
        typeof raw.value !== "string" ||
        typeof raw.confidence !== "number" ||
        typeof raw.source !== "string"
      ) {
        return undefined;
      }

      return {
        key: raw.key,
        value: raw.value,
        confidence: raw.confidence,
        source: raw.source
      } satisfies ExtractedEntity;
    })
    .filter((entity): entity is ExtractedEntity => entity !== undefined);
}

function ensureStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function ensureMetrics(value: Prisma.JsonValue): StructuredData["metrics"] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const output: StructuredData["metrics"] = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" || typeof raw === "string") {
      output[key] = raw;
      continue;
    }

    if (Array.isArray(raw)) {
      output[key] = raw.filter((item): item is string => typeof item === "string");
    }
  }

  return output;
}

function toTask(task: PrismaCaseWithRelations["tasks"][number]): Task {
  return {
    id: task.id,
    title: task.title,
    owner: task.owner,
    dueInDays: task.dueInDays,
    priority: task.priority as Task["priority"],
    status: task.status as Task["status"]
  };
}

function toAction(action: PrismaCaseWithRelations["actions"][number]): SuggestedAction {
  return {
    id: action.id,
    type: action.type as ActionType,
    title: action.title,
    description: action.description,
    draft: action.draft,
    requiresApproval: action.requiresApproval,
    status: action.status as SuggestedAction["status"],
    executedAt: action.executedAt?.toISOString()
  };
}

function toCaseRecord(record: PrismaCaseWithRelations): CaseRecord {
  return {
    id: record.id,
    vertical: record.vertical as Vertical,
    channel: record.channel as CaseRecord["channel"],
    rawInput: record.rawInput,
    structured: {
      vertical: record.vertical as Vertical,
      summary: record.summary,
      entities: ensureEntityArray(record.entities),
      signals: ensureStringArray(record.signals),
      metrics: ensureMetrics(record.metrics),
      confidence: record.confidence
    },
    tasks: record.tasks.map(toTask),
    actions: record.actions.map(toAction),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export class PrismaCaseRepository implements CaseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(userId: string, input: CreateCaseInput): Promise<CaseRecord> {
    const created = await this.prisma.case.create({
      data: {
        userId,
        vertical: input.vertical,
        channel: input.channel,
        rawInput: input.rawInput,
        summary: input.structured.summary,
        confidence: input.structured.confidence,
        entities: input.structured.entities as unknown as Prisma.JsonArray,
        signals: input.structured.signals as unknown as Prisma.JsonArray,
        metrics: input.structured.metrics as unknown as Prisma.JsonObject,
        tasks: {
          create: input.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            owner: task.owner,
            dueInDays: task.dueInDays,
            priority: task.priority,
            status: task.status
          }))
        },
        actions: {
          create: input.actions.map((action) => ({
            id: action.id,
            type: action.type,
            title: action.title,
            description: action.description,
            draft: action.draft,
            requiresApproval: action.requiresApproval,
            status: action.status,
            executedAt: action.executedAt ? new Date(action.executedAt) : null
          }))
        }
      },
      include: caseInclude
    });

    return toCaseRecord(created);
  }

  async list(userId: string, vertical?: Vertical): Promise<CaseRecord[]> {
    const records = await this.prisma.case.findMany({
      where: {
        userId,
        ...(vertical ? { vertical } : {})
      },
      include: caseInclude,
      orderBy: {
        createdAt: "desc"
      }
    });

    return records.map(toCaseRecord);
  }

  async getById(userId: string, caseId: string): Promise<CaseRecord | undefined> {
    const record = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        userId
      },
      include: caseInclude
    });

    return record ? toCaseRecord(record) : undefined;
  }

  async markActionExecuted(userId: string, caseId: string, actionId: string): Promise<CaseRecord | undefined> {
    const action = await this.prisma.action.findFirst({
      where: {
        id: actionId,
        caseId,
        case: {
          userId
        }
      }
    });

    if (!action) {
      return undefined;
    }

    await this.prisma.action.update({
      where: { id: actionId },
      data: {
        status: "executed",
        executedAt: new Date()
      }
    });

    await this.prisma.case.update({
      where: { id: caseId },
      data: {
        updatedAt: new Date()
      }
    });

    return this.getById(userId, caseId);
  }
}
