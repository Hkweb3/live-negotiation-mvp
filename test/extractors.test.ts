import { describe, expect, it } from "vitest";
import { buildStructuredData } from "../src/lib/extractors";

describe("buildStructuredData", () => {
  it("extracts scope-shield scope creep signals", () => {
    const result = buildStructuredData({
      vertical: "scope-shield",
      channel: "email",
      content:
        "Can you add two extra pages and another revision? Original project fee is $4500 and we need this urgent.",
      context: {
        customerName: "Avery",
        counterparty: "Client"
      }
    });

    expect(result.signals).toContain("scope-creep-detected");
    expect(result.entities.some((entity) => entity.key === "original_budget")).toBe(true);
  });

  it("extracts deal-pilot pricing and fee signals", () => {
    const result = buildStructuredData({
      vertical: "deal-pilot",
      channel: "photo",
      content:
        "Out-the-door price $32,500. APR 9.4%. 72 months. Doc fee $899. Protection package $1299. $620/mo",
      context: {
        customerName: "Jamie",
        counterparty: "Dealer"
      }
    });

    expect(result.metrics.apr).toBe(9.4);
    expect(result.metrics.suspiciousFeesTotal).toBe(2198);
    expect(result.signals).toContain("high-fee-risk");
  });
});
