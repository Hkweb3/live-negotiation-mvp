import { describe, expect, it, vi } from "vitest";

describe("createContainer", () => {
  it("builds memory container when DATABASE_URL is not set", async () => {
    const { appConfig } = await import("../src/config");
    const { createContainer } = await import("../src/bootstrap/container");

    const prevDb = appConfig.databaseUrl;
    const prevKey = appConfig.openAiApiKey;
    appConfig.databaseUrl = undefined;
    appConfig.openAiApiKey = undefined;

    const container = createContainer();
    expect(container.persistenceMode).toBe("memory");
    expect(container.aiMode).toBe("heuristic");

    await container.close();
    appConfig.databaseUrl = prevDb;
    appConfig.openAiApiKey = prevKey;
  });

  it("builds postgres container when DATABASE_URL is configured", async () => {
    vi.resetModules();
    const disconnect = vi.fn(async () => {});

    vi.doMock("../src/repositories/prismaClient", () => ({
      getPrismaClient: () => ({
        $disconnect: disconnect
      })
    }));

    const { appConfig } = await import("../src/config");
    const { createContainer } = await import("../src/bootstrap/container");

    const prevDb = appConfig.databaseUrl;
    appConfig.databaseUrl = "postgresql://postgres:postgres@localhost:5432/live_negotiation";

    const container = createContainer();
    expect(container.persistenceMode).toBe("postgres");
    await container.close();
    expect(disconnect).toHaveBeenCalledTimes(1);

    appConfig.databaseUrl = prevDb;
  });
});
