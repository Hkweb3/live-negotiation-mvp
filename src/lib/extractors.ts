import { IngestionRequest, StructuredData, Vertical, ExtractedEntity } from "../types";

const scopeCreepKeywords = [
  "extra",
  "add",
  "additional",
  "revision",
  "scope",
  "new feature",
  "change request",
  "urgent"
];

const dealerFeeLabels = [
  "dealer fee",
  "doc fee",
  "documentation fee",
  "nitrogen",
  "paint protection",
  "protection package",
  "market adjustment",
  "vin etch"
];

function normalizeAmount(raw: string): number {
  return Number.parseFloat(raw.replace(/[,$]/g, ""));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractAmountNearLabel(line: string, label: string): number | undefined {
  const labelPattern = escapeRegExp(label);
  const afterLabel = new RegExp(`${labelPattern}\\D{0,18}\\$\\s*([\\d,]+(?:\\.\\d{2})?)`, "i");
  const beforeLabel = new RegExp(`\\$\\s*([\\d,]+(?:\\.\\d{2})?)\\D{0,12}${labelPattern}`, "i");

  const afterMatch = line.match(afterLabel);
  if (afterMatch) {
    return normalizeAmount(afterMatch[1]);
  }

  const beforeMatch = line.match(beforeLabel);
  if (beforeMatch) {
    return normalizeAmount(beforeMatch[1]);
  }

  return undefined;
}

function buildSummary(vertical: Vertical, signals: string[]): string {
  if (vertical === "scope-shield") {
    if (signals.includes("scope-creep-detected")) {
      return "Potential scope creep detected. Lock scope and issue a paid change order.";
    }

    return "Client request captured. Validate scope boundaries before committing.";
  }

  if (signals.includes("high-fee-risk")) {
    return "Dealer quote has suspicious fee load. Counter with OTD-first pricing.";
  }

  return "Quote captured. Push for cleaner OTD and financing terms.";
}

export function buildStructuredData(input: IngestionRequest): StructuredData {
  const lines = input.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const contentLower = input.content.toLowerCase();
  const entities: ExtractedEntity[] = [];
  const signals: string[] = [];
  const metrics: StructuredData["metrics"] = {};

  if (input.vertical === "scope-shield") {
    const matchedKeywords = scopeCreepKeywords.filter((keyword) => contentLower.includes(keyword));
    if (matchedKeywords.length > 0) {
      signals.push("scope-creep-detected");
      metrics.scopeCreepKeywords = matchedKeywords;
    }

    const addedRequests = lines.filter((line) => /add|extra|another|new|include/i.test(line));
    if (addedRequests.length > 0) {
      metrics.addedRequests = addedRequests;
      entities.push({
        key: "added_requests",
        value: `${addedRequests.length} possible added request(s)`,
        confidence: 0.76,
        source: addedRequests[0]
      });
    }

    const budgetMatch = input.content.match(/(?:budget|project fee|price|quote)\D{0,12}\$\s*([\d,]+(?:\.\d{2})?)/i);
    if (budgetMatch) {
      const budget = normalizeAmount(budgetMatch[1]);
      metrics.originalBudget = budget;
      entities.push({
        key: "original_budget",
        value: budget.toFixed(2),
        confidence: 0.72,
        source: budgetMatch[0]
      });
    }

    const deadlineMatch = input.content.match(/(?:by|before|deadline)\s+([A-Za-z]+\s+\d{1,2})/i);
    if (deadlineMatch) {
      entities.push({
        key: "deadline_hint",
        value: deadlineMatch[1],
        confidence: 0.63,
        source: deadlineMatch[0]
      });
    }
  } else {
    const aprMatch = input.content.match(
      /(?:apr\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%?)|(?:(\d+(?:\.\d+)?)\s*%\s*apr)/i
    );
    if (aprMatch) {
      const apr = Number.parseFloat(aprMatch[1] ?? aprMatch[2]);
      metrics.apr = apr;
      entities.push({
        key: "apr",
        value: apr.toFixed(2),
        confidence: 0.86,
        source: aprMatch[0]
      });
      if (apr >= 8) {
        signals.push("high-apr-risk");
      }
    }

    const termMatch = input.content.match(/(\d{2,3})\s*(?:month|mo)\b/i);
    if (termMatch) {
      const termMonths = Number.parseInt(termMatch[1], 10);
      metrics.termMonths = termMonths;
      entities.push({
        key: "loan_term_months",
        value: termMonths.toString(),
        confidence: 0.82,
        source: termMatch[0]
      });
    }

    const otdMatch = input.content.match(/(?:otd|out[-\s]?the[-\s]?door(?:\s*price)?)\D{0,16}\$\s*([\d,]+(?:\.\d{2})?)/i);
    if (otdMatch) {
      const otd = normalizeAmount(otdMatch[1]);
      metrics.otdPrice = otd;
      entities.push({
        key: "otd_price",
        value: otd.toFixed(2),
        confidence: 0.88,
        source: otdMatch[0]
      });
    }

    const monthlyMatch = input.content.match(/\$\s*([\d,]+(?:\.\d{2})?)\s*(?:\/\s*mo|per\s*month|monthly)/i);
    if (monthlyMatch) {
      const monthlyPayment = normalizeAmount(monthlyMatch[1]);
      metrics.monthlyPayment = monthlyPayment;
      entities.push({
        key: "monthly_payment",
        value: monthlyPayment.toFixed(2),
        confidence: 0.75,
        source: monthlyMatch[0]
      });
    }

    const suspiciousFees: Array<{ label: string; amount: number }> = [];
    for (const line of lines) {
      const normalizedLine = line.toLowerCase();
      for (const label of dealerFeeLabels) {
        if (!normalizedLine.includes(label)) {
          continue;
        }

        const amount = extractAmountNearLabel(line, label);
        if (amount === undefined) {
          continue;
        }

        suspiciousFees.push({ label, amount });
      }
    }

    if (suspiciousFees.length > 0) {
      const totalSuspiciousFees = suspiciousFees.reduce((sum, item) => sum + item.amount, 0);
      metrics.suspiciousFeesTotal = totalSuspiciousFees;
      metrics.suspiciousFeesBreakdown = suspiciousFees.map((fee) => `${fee.label}: $${fee.amount.toFixed(2)}`);
      signals.push("high-fee-risk");

      entities.push({
        key: "suspicious_fees_total",
        value: totalSuspiciousFees.toFixed(2),
        confidence: 0.81,
        source: suspiciousFees[0].label
      });
    }
  }

  const confidenceBase = entities.length >= 3 ? 0.85 : entities.length === 2 ? 0.74 : 0.62;
  const confidence = Number.parseFloat(Math.min(0.95, confidenceBase + signals.length * 0.03).toFixed(2));

  return {
    vertical: input.vertical,
    summary: buildSummary(input.vertical, signals),
    entities,
    signals,
    metrics,
    confidence
  };
}
