import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("redis", () => ({
  createClient: vi.fn()
}));

describe("rate limit store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses memory mode when REDIS_URL is not configured", async () => {
    vi.resetModules();
    const { appConfig } = await import("../src/config");
    appConfig.redisUrl = undefined;

    const rateLimit = await import("../src/middleware/rateLimit");
    const mode = await rateLimit.initializeRateLimitStore();
    const limiters = rateLimit.createRateLimiters();

    expect(mode).toBe("memory");
    expect(limiters.rateLimitMode).toBe("memory");

    await rateLimit.closeRateLimitStore();
  });

  it("connects to redis mode when client connects", async () => {
    vi.resetModules();
    const redis = await import("redis");

    const client = {
      isOpen: false,
      on: vi.fn(),
      connect: vi.fn(async () => {
        client.isOpen = true;
      }),
      quit: vi.fn(async () => {
        client.isOpen = false;
      }),
      sendCommand: vi.fn(async () => 1)
    };

    vi.mocked(redis.createClient).mockReturnValue(client as never);

    const { appConfig } = await import("../src/config");
    appConfig.redisUrl = "redis://localhost:6379";

    const rateLimit = await import("../src/middleware/rateLimit");
    const mode = await rateLimit.initializeRateLimitStore();

    expect(mode).toBe("redis");

    await rateLimit.closeRateLimitStore();
    expect(client.quit).toHaveBeenCalledTimes(1);
  });

  it("falls back to memory when redis connection fails", async () => {
    vi.resetModules();
    const redis = await import("redis");

    const client = {
      isOpen: false,
      on: vi.fn(),
      connect: vi.fn(async () => {
        throw new Error("redis unavailable");
      }),
      quit: vi.fn(async () => {
        client.isOpen = false;
      }),
      sendCommand: vi.fn(async () => 1)
    };

    vi.mocked(redis.createClient).mockReturnValue(client as never);

    const { appConfig } = await import("../src/config");
    appConfig.redisUrl = "redis://localhost:6379";

    const rateLimit = await import("../src/middleware/rateLimit");
    const mode = await rateLimit.initializeRateLimitStore();

    expect(mode).toBe("memory");

    await rateLimit.closeRateLimitStore();
  });
});
