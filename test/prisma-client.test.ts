import { describe, expect, it, vi } from "vitest";

const disconnect = vi.fn(async () => {});
const prismaCtor = vi.fn();

class MockPrismaClient {
  $disconnect = disconnect;

  constructor() {
    prismaCtor();
  }
}

vi.mock("@prisma/client", () => ({
  PrismaClient: MockPrismaClient
}));

describe("getPrismaClient", () => {
  it("returns a singleton prisma client instance", async () => {
    const { getPrismaClient } = await import("../src/repositories/prismaClient");

    const first = getPrismaClient();
    const second = getPrismaClient();

    expect(first).toBe(second);
    expect(prismaCtor).toHaveBeenCalledTimes(1);
    await first.$disconnect();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
