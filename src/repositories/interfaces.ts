import { CaseRecord, IngestionRequest, SuggestedAction, Task, UserRecord, UserRole, Vertical } from "../types";

export interface CreateCaseInput {
  vertical: IngestionRequest["vertical"];
  channel: IngestionRequest["channel"];
  rawInput: string;
  structured: CaseRecord["structured"];
  tasks: Task[];
  actions: SuggestedAction[];
}

export interface CaseRepository {
  create(userId: string, input: CreateCaseInput): Promise<CaseRecord>;
  list(userId: string, vertical?: Vertical): Promise<CaseRecord[]>;
  getById(userId: string, caseId: string): Promise<CaseRecord | undefined>;
  markActionExecuted(userId: string, caseId: string, actionId: string): Promise<CaseRecord | undefined>;
}

export interface CreateUserInput {
  email: string;
  name?: string;
  role: UserRole;
  passwordHash: string;
}

export interface AuthRepository {
  create(input: CreateUserInput): Promise<UserRecord>;
  findByEmail(email: string): Promise<UserRecord | undefined>;
  findById(id: string): Promise<UserRecord | undefined>;
}
