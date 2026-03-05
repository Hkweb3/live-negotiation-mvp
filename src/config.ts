import dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

const jwtSecret = process.env.JWT_SECRET ?? (isProduction ? undefined : "dev-only-change-me");

if (!jwtSecret) {
  throw new Error("JWT_SECRET is required in production");
}

if (!process.env.JWT_SECRET && !isProduction) {
  console.warn("JWT_SECRET not set. Using development fallback secret.");
}

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const appConfig = {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
  jwtSecret,
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "lna_session",
  sessionTtlSeconds: Number.parseInt(process.env.SESSION_TTL_SECONDS ?? "604800", 10),
  adminEmails,
  apiRateLimitWindowMs: Number.parseInt(process.env.API_RATE_LIMIT_WINDOW_MS ?? "60000", 10),
  apiRateLimitMax: Number.parseInt(process.env.API_RATE_LIMIT_MAX ?? "120", 10),
  authRateLimitWindowMs: Number.parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? "900000", 10),
  authRateLimitMax: Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? "25", 10),
  redisUrl: process.env.REDIS_URL,
  apiRateLimitPrefix: process.env.API_RATE_LIMIT_PREFIX ?? "rl:api",
  authRateLimitPrefix: process.env.AUTH_RATE_LIMIT_PREFIX ?? "rl:auth",
  cookieSecure: isProduction,
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  databaseUrl: process.env.DATABASE_URL,
  nodeEnv: process.env.NODE_ENV ?? "development"
};
