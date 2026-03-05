import { randomUUID } from "node:crypto";
import { IngestionRequest, StructuredData, SuggestedAction, Task } from "../types";

function getStringList(value: StructuredData["metrics"][string]): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item));
}

function formatCurrency(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return "N/A";
  }

  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

export function buildTasksAndActions(
  input: IngestionRequest,
  structured: StructuredData
): { tasks: Task[]; actions: SuggestedAction[] } {
  if (input.vertical === "scope-shield") {
    const requests = getStringList(structured.metrics.addedRequests);
    const budget = typeof structured.metrics.originalBudget === "number" ? structured.metrics.originalBudget : undefined;

    const tasks: Task[] = [
      {
        id: randomUUID(),
        title: "Classify each client ask as in-scope or out-of-scope",
        owner: "You",
        dueInDays: 1,
        priority: "high",
        status: "open"
      },
      {
        id: randomUUID(),
        title: "Send paid change-order proposal before doing new work",
        owner: "You",
        dueInDays: 1,
        priority: "high",
        status: "open"
      },
      {
        id: randomUUID(),
        title: "Update invoice and timeline after approval",
        owner: "You",
        dueInDays: 2,
        priority: "medium",
        status: "open"
      }
    ];

    const requestsSection =
      requests.length > 0
        ? requests.map((request, index) => `${index + 1}. ${request}`).join("\n")
        : "1. Requested additions from latest thread";

    const scopeResponseDraft = `Hi ${input.context?.counterparty ?? "[Client Name]"},\n\nThanks for the detailed requests. I mapped these items against our current scope:\n${requestsSection}\n\nI can absolutely deliver them through a paid change order so quality and delivery date stay protected. If you approve, I will send the revised estimate and start immediately.\n\nBest,\n${input.context?.customerName ?? "[Your Name]"}`;

    const changeOrderDraft = `Subject: Change Order - Additional Work Approval\n\nHi ${input.context?.counterparty ?? "[Client Name]"},\n\nBased on your latest requests, here is the change order summary:\n- Added scope items:\n${requestsSection}\n- Original project fee: ${formatCurrency(budget)}\n- Incremental fee: [Fill amount]\n- Timeline impact: +[X] business days\n\nReply with "Approved" and I will proceed.\n\nThanks,\n${input.context?.customerName ?? "[Your Name]"}`;

    const followUpDraft = `Subject: Invoice Follow-up - Change Order\n\nHi ${input.context?.counterparty ?? "[Client Name]"},\n\nQuick follow-up on the approved change order. I have attached the updated invoice and payment link. Once payment is confirmed, I will ship the next milestone within the agreed timeline.\n\nBest,\n${input.context?.customerName ?? "[Your Name]"}`;

    const actions: SuggestedAction[] = [
      {
        id: randomUUID(),
        type: "scope_response_script",
        title: "Draft boundary response",
        description: "Send a calm but firm response that protects scope before new work starts.",
        draft: scopeResponseDraft,
        requiresApproval: true,
        status: "proposed"
      },
      {
        id: randomUUID(),
        type: "change_order_email",
        title: "Draft paid change order",
        description: "Create an approval-ready change order email with pricing and timeline language.",
        draft: changeOrderDraft,
        requiresApproval: true,
        status: "proposed"
      },
      {
        id: randomUUID(),
        type: "invoice_followup",
        title: "Draft invoice follow-up",
        description: "Prepare payment follow-up copy to close the loop after approval.",
        draft: followUpDraft,
        requiresApproval: true,
        status: "proposed"
      }
    ];

    return { tasks, actions };
  }

  const apr = typeof structured.metrics.apr === "number" ? structured.metrics.apr : undefined;
  const otdPrice = typeof structured.metrics.otdPrice === "number" ? structured.metrics.otdPrice : undefined;
  const suspiciousFeesTotal =
    typeof structured.metrics.suspiciousFeesTotal === "number"
      ? structured.metrics.suspiciousFeesTotal
      : undefined;
  const suspiciousFeesBreakdown = getStringList(structured.metrics.suspiciousFeesBreakdown);

  const tasks: Task[] = [
    {
      id: randomUUID(),
      title: "Request itemized OTD quote with every fee line",
      owner: "You",
      dueInDays: 0,
      priority: "high",
      status: "open"
    },
    {
      id: randomUUID(),
      title: "Send counteroffer to at least 2 competing dealers",
      owner: "You",
      dueInDays: 1,
      priority: "high",
      status: "open"
    },
    {
      id: randomUUID(),
      title: "Get financing pre-approval before final signature",
      owner: "You",
      dueInDays: 1,
      priority: "medium",
      status: "open"
    }
  ];

  const feeLines =
    suspiciousFeesBreakdown.length > 0
      ? suspiciousFeesBreakdown.map((line, index) => `${index + 1}. ${line}`).join("\n")
      : "1. Dealer add-on fee line items not yet validated";

  const counterofferDraft = `Subject: Purchase Offer - OTD Only\n\nHi ${input.context?.counterparty ?? "[Dealer Contact]"},\n\nI am ready to buy this week if we can agree on a clean out-the-door price.\n- My target OTD: ${formatCurrency(otdPrice !== undefined ? otdPrice - 1200 : undefined)}\n- Remove non-essential add-ons and dealer packages\n- Send final itemized buyer order for review\n\nIf these terms work, I can place deposit today.\n\nThanks,\n${input.context?.customerName ?? "[Buyer Name]"}`;

  const feeDisputeDraft = `Call Script - Fee Challenge\n\nI want to proceed, but these fees need to be removed or justified:\n${feeLines}\n\nI will only sign on itemized, mandatory charges. If these are optional, please remove them from the buyer order and resend the OTD sheet.`;

  const walkAwayDraft = `Thanks for the quote. I am pausing this deal for now because the total pricing and fee structure are not competitive. If you can provide a revised OTD with unnecessary add-ons removed, I can reconsider quickly.`;

  const aprText = apr !== undefined ? `${apr.toFixed(2)}%` : "N/A";

  const actions: SuggestedAction[] = [
    {
      id: randomUUID(),
      type: "dealer_counteroffer_email",
      title: "Draft OTD counteroffer",
      description: `Push for clean OTD pricing and remove inflated fees. Detected APR: ${aprText}.`,
      draft: counterofferDraft,
      requiresApproval: true,
      status: "proposed"
    },
    {
      id: randomUUID(),
      type: "fee_dispute_script",
      title: "Draft fee dispute script",
      description: `Challenge fee stack (${formatCurrency(suspiciousFeesTotal)}) with specific lines.`,
      draft: feeDisputeDraft,
      requiresApproval: true,
      status: "proposed"
    },
    {
      id: randomUUID(),
      type: "walk_away_message",
      title: "Draft walk-away message",
      description: "Keep leverage if pricing remains inflated.",
      draft: walkAwayDraft,
      requiresApproval: true,
      status: "proposed"
    }
  ];

  return { tasks, actions };
}
