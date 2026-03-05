import { randomUUID } from "node:crypto";
import { CaseRecord, SuggestedAction } from "../types";
import { CaseRepository, CreateCaseInput } from "./interfaces";

interface StoredCaseRecord extends CaseRecord {
  userId: string;
}

export class InMemoryCaseRepository implements CaseRepository {
  private readonly cases = new Map<string, StoredCaseRecord>();

  async create(userId: string, input: CreateCaseInput): Promise<CaseRecord> {
    const now = new Date().toISOString();

    const record: StoredCaseRecord = {
      id: randomUUID(),
      userId,
      vertical: input.vertical,
      channel: input.channel,
      rawInput: input.rawInput,
      structured: input.structured,
      tasks: input.tasks,
      actions: input.actions,
      createdAt: now,
      updatedAt: now
    };

    this.cases.set(record.id, record);
    return this.stripUserId(record);
  }

  async list(userId: string, vertical?: CreateCaseInput["vertical"]): Promise<CaseRecord[]> {
    const records = Array.from(this.cases.values())
      .filter((record) => record.userId === userId && (!vertical || record.vertical === vertical))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return records.map((record) => this.stripUserId(record));
  }

  async getById(userId: string, caseId: string): Promise<CaseRecord | undefined> {
    const record = this.cases.get(caseId);
    if (!record || record.userId !== userId) {
      return undefined;
    }

    return this.stripUserId(record);
  }

  async markActionExecuted(userId: string, caseId: string, actionId: string): Promise<CaseRecord | undefined> {
    const record = this.cases.get(caseId);
    if (!record || record.userId !== userId) {
      return undefined;
    }

    const actionExists = record.actions.some((action) => action.id === actionId);
    if (!actionExists) {
      return undefined;
    }

    const actions: SuggestedAction[] = record.actions.map((action) => {
      if (action.id !== actionId) {
        return action;
      }

      return {
        ...action,
        status: "executed",
        executedAt: new Date().toISOString()
      };
    });

    const updatedRecord: StoredCaseRecord = {
      ...record,
      actions,
      updatedAt: new Date().toISOString()
    };

    this.cases.set(caseId, updatedRecord);
    return this.stripUserId(updatedRecord);
  }

  private stripUserId(record: StoredCaseRecord): CaseRecord {
    const { userId: _userId, ...caseRecord } = record;
    return caseRecord;
  }
}
