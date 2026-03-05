import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { z } from "zod";
import { buildStructuredData } from "../lib/extractors";
import { buildTasksAndActions } from "../lib/recommendations";
import { appConfig } from "../config";
import {
  ActionType,
  IngestionRequest,
  StructuredData,
  SuggestedAction,
  Task
} from "../types";

export interface NegotiationResult {
  structured: StructuredData;
  tasks: Task[];
  actions: SuggestedAction[];
  source: "llm" | "heuristic";
}

export interface NegotiationEngine {
  analyze(request: IngestionRequest): Promise<NegotiationResult>;
}

const actionTypeByVertical: Record<IngestionRequest["vertical"], ActionType[]> = {
  "scope-shield": ["scope_response_script", "change_order_email", "invoice_followup"],
  "deal-pilot": ["dealer_counteroffer_email", "walk_away_message", "fee_dispute_script"]
};

const llmResponseSchema = z.object({
  summary: z.string().min(8),
  confidence: z.number().min(0).max(1),
  signals: z.array(z.string()).default([]),
  entities: z
    .array(
      z.object({
        key: z.string().min(1),
        value: z.string().min(1),
        confidence: z.number().min(0).max(1),
        source: z.string().min(1)
      })
    )
    .default([]),
  metrics: z.record(z.string(), z.union([z.number(), z.string(), z.array(z.string())])).default({}),
  tasks: z
    .array(
      z.object({
        title: z.string().min(5),
        owner: z.string().min(1).default("You"),
        dueInDays: z.number().int().min(0).max(30),
        priority: z.enum(["high", "medium", "low"])
      })
    )
    .min(1)
    .max(6),
  actions: z
    .array(
      z.object({
        type: z.enum([
          "scope_response_script",
          "change_order_email",
          "invoice_followup",
          "dealer_counteroffer_email",
          "walk_away_message",
          "fee_dispute_script"
        ]),
        title: z.string().min(5),
        description: z.string().min(5),
        draft: z.string().min(10),
        requiresApproval: z.boolean().default(true)
      })
    )
    .min(1)
    .max(6)
});

export class HeuristicNegotiationEngine implements NegotiationEngine {
  async analyze(request: IngestionRequest): Promise<NegotiationResult> {
    const structured = buildStructuredData(request);
    const { tasks, actions } = buildTasksAndActions(request, structured);

    return {
      structured,
      tasks,
      actions,
      source: "heuristic"
    };
  }
}

export class OpenAINegotiationEngine implements NegotiationEngine {
  private readonly fallback: HeuristicNegotiationEngine;
  private readonly client?: OpenAI;

  constructor() {
    this.fallback = new HeuristicNegotiationEngine();
    if (appConfig.openAiApiKey) {
      this.client = new OpenAI({ apiKey: appConfig.openAiApiKey });
    }
  }

  async analyze(request: IngestionRequest): Promise<NegotiationResult> {
    if (!this.client) {
      return this.fallback.analyze(request);
    }

    try {
      const response = await this.client.chat.completions.create({
        model: appConfig.openAiModel,
        temperature: 0.2,
        response_format: {
          type: "json_object"
        },
        messages: [
          {
            role: "system",
            content:
              "You are a negotiation copilot. Return valid JSON with keys: summary, confidence, signals, entities, metrics, tasks, actions. Be source-grounded and concise."
          },
          {
            role: "user",
            content: [
              `Vertical: ${request.vertical}`,
              `Allowed action types: ${actionTypeByVertical[request.vertical].join(", ")}`,
              "Input:",
              JSON.stringify(request)
            ].join("\n")
          }
        ]
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return this.fallback.analyze(request);
      }

      const parsedJson = JSON.parse(content) as unknown;
      const parsed = llmResponseSchema.safeParse(parsedJson);

      if (!parsed.success) {
        return this.fallback.analyze(request);
      }

      const filteredActions = parsed.data.actions.filter((action) =>
        actionTypeByVertical[request.vertical].includes(action.type)
      );

      if (filteredActions.length === 0) {
        return this.fallback.analyze(request);
      }

      const normalizedMetrics: StructuredData["metrics"] = {};
      for (const [key, value] of Object.entries(parsed.data.metrics)) {
        if (typeof value === "number" || typeof value === "string") {
          normalizedMetrics[key] = value;
          continue;
        }

        if (Array.isArray(value)) {
          normalizedMetrics[key] = value.filter((entry): entry is string => typeof entry === "string");
        }
      }

      const structured: StructuredData = {
        vertical: request.vertical,
        summary: parsed.data.summary,
        entities: parsed.data.entities,
        signals: parsed.data.signals,
        metrics: normalizedMetrics,
        confidence: parsed.data.confidence
      };

      const tasks: Task[] = parsed.data.tasks.map((task) => ({
        id: randomUUID(),
        title: task.title,
        owner: task.owner,
        dueInDays: task.dueInDays,
        priority: task.priority,
        status: "open"
      }));

      const actions: SuggestedAction[] = filteredActions.map((action) => ({
        id: randomUUID(),
        type: action.type,
        title: action.title,
        description: action.description,
        draft: action.draft,
        requiresApproval: action.requiresApproval,
        status: "proposed"
      }));

      return {
        structured,
        tasks,
        actions,
        source: "llm"
      };
    } catch {
      return this.fallback.analyze(request);
    }
  }
}
