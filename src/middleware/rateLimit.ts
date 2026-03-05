import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";
import { appConfig } from "../config";

type RedisReplyPrimitive = boolean | number | string;
type RedisReply = RedisReplyPrimitive | RedisReplyPrimitive[];

let redisClient: ReturnType<typeof createClient> | undefined;
let rateLimitMode: "memory" | "redis" = "memory";

function buildStore(prefix: string): RedisStore | undefined {
  if (!redisClient || !redisClient.isOpen) {
    return undefined;
  }

  return new RedisStore({
    sendCommand: (...args: string[]) => redisClient!.sendCommand(args) as Promise<RedisReply>,
    prefix
  });
}

function createLimiter(config: {
  windowMs: number;
  max: number;
  message: string;
  prefix: string;
}) {
  const store = buildStore(config.prefix);

  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: config.message
    },
    ...(store ? { store } : {})
  });
}

export async function initializeRateLimitStore(): Promise<"memory" | "redis"> {
  if (!appConfig.redisUrl) {
    rateLimitMode = "memory";
    return rateLimitMode;
  }

  if (redisClient?.isOpen) {
    rateLimitMode = "redis";
    return rateLimitMode;
  }

  const client = createClient({ url: appConfig.redisUrl });
  client.on("error", (error) => {
    console.error(`Redis error: ${error.message}`);
  });

  try {
    await client.connect();
    redisClient = client;
    rateLimitMode = "redis";
    return rateLimitMode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Redis unavailable for rate limit store. Falling back to memory store. Reason: ${message}`);

    try {
      if (client.isOpen) {
        await client.quit();
      }
    } catch {
      // swallow cleanup errors in fallback flow
    }

    redisClient = undefined;
    rateLimitMode = "memory";
    return rateLimitMode;
  }
}

export function createRateLimiters() {
  return {
    rateLimitMode,
    apiLimiter: createLimiter({
      windowMs: appConfig.apiRateLimitWindowMs,
      max: appConfig.apiRateLimitMax,
      message: "Too many requests. Please retry shortly.",
      prefix: appConfig.apiRateLimitPrefix
    }),
    authLimiter: createLimiter({
      windowMs: appConfig.authRateLimitWindowMs,
      max: appConfig.authRateLimitMax,
      message: "Too many authentication attempts. Please retry later.",
      prefix: appConfig.authRateLimitPrefix
    })
  };
}

export async function closeRateLimitStore(): Promise<void> {
  if (redisClient?.isOpen) {
    await redisClient.quit();
  }

  redisClient = undefined;
  rateLimitMode = "memory";
}
