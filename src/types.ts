export type Vertical = "scope-shield" | "deal-pilot";

export type IngestChannel = "text" | "email" | "voice" | "photo";

export interface IngestionRequest {
  vertical: Vertical;
  channel: IngestChannel;
  content: string;
  context?: {
    customerName?: string;
    counterparty?: string;
    location?: string;
  };
}

export interface ExtractedEntity {
  key: string;
  value: string;
  confidence: number;
  source: string;
}

export interface StructuredData {
  vertical: Vertical;
  summary: string;
  entities: ExtractedEntity[];
  signals: string[];
  metrics: Record<string, number | string | string[] | undefined>;
  confidence: number;
}

export type TaskStatus = "open" | "done";

export interface Task {
  id: string;
  title: string;
  owner: string;
  dueInDays: number;
  priority: "high" | "medium" | "low";
  status: TaskStatus;
}

export type ActionType =
  | "scope_response_script"
  | "change_order_email"
  | "invoice_followup"
  | "dealer_counteroffer_email"
  | "walk_away_message"
  | "fee_dispute_script";

export interface SuggestedAction {
  id: string;
  type: ActionType;
  title: string;
  description: string;
  draft: string;
  requiresApproval: boolean;
  status: "proposed" | "executed";
  executedAt?: string;
}

export interface CaseRecord {
  id: string;
  vertical: Vertical;
  channel: IngestChannel;
  rawInput: string;
  structured: StructuredData;
  tasks: Task[];
  actions: SuggestedAction[];
  createdAt: string;
  updatedAt: string;
}

export interface UserRecord {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = "user" | "admin";

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  createdAt: string;
}

export interface SessionClaims {
  userId: string;
  email: string;
  role: UserRole;
}
