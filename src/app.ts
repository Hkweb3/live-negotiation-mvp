import cookieParser from "cookie-parser";
import express, { NextFunction, Request, Response } from "express";
import path from "node:path";
import { z } from "zod";
import { createRequireAuth, createRequireRole, AuthenticatedRequest } from "./auth/authMiddleware";
import { createContainer, AppContainer } from "./bootstrap/container";
import { appConfig } from "./config";
import { AppError } from "./lib/errors";
import { createRateLimiters } from "./middleware/rateLimit";
import { Vertical } from "./types";

const ingestSchema = z.object({
  vertical: z.enum(["scope-shield", "deal-pilot"]),
  channel: z.enum(["text", "email", "voice", "photo"]),
  content: z.string().min(10).max(20_000),
  context: z
    .object({
      customerName: z.string().min(1).max(120).optional(),
      counterparty: z.string().min(1).max(120).optional(),
      location: z.string().min(1).max(120).optional()
    })
    .optional()
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

function setSessionCookie(res: Response, token: string): void {
  res.cookie(appConfig.sessionCookieName, token, {
    httpOnly: true,
    secure: appConfig.cookieSecure,
    sameSite: "strict",
    path: "/",
    maxAge: appConfig.sessionTtlSeconds * 1000
  });
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(appConfig.sessionCookieName, {
    httpOnly: true,
    secure: appConfig.cookieSecure,
    sameSite: "strict",
    path: "/"
  });
}

function handleError(res: Response, error: unknown): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code
    });
    return;
  }

  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR"
  });
}

export function createApp(containerArg?: AppContainer) {
  const container = containerArg ?? createContainer();

  const app = express();
  app.locals.container = container;
  const { apiLimiter, authLimiter, rateLimitMode } = createRateLimiters();

  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  app.use("/api", apiLimiter);

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      service: "live-negotiation-ai-mvp",
      persistenceMode: container.persistenceMode,
      aiMode: container.aiMode,
      rateLimitMode
    });
  });

  app.post("/api/auth/register", authLimiter, async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten()
      });
    }

    try {
      const user = await container.authService.register(parsed.data);
      const token = container.authService.createSessionToken(user);
      setSessionCookie(res, token);
      return res.status(201).json({ user });
    } catch (error) {
      handleError(res, error);
      return;
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten()
      });
    }

    try {
      const user = await container.authService.login(parsed.data);
      const token = container.authService.createSessionToken(user);
      setSessionCookie(res, token);
      return res.json({ user });
    } catch (error) {
      handleError(res, error);
      return;
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    clearSessionCookie(res);
    res.status(204).send();
  });

  app.get("/api/auth/me", async (req, res) => {
    const token = req.cookies?.[appConfig.sessionCookieName];
    if (!token || typeof token !== "string") {
      return res.json({ user: null });
    }

    try {
      const claims = container.authService.verifySessionToken(token);
      const user = await container.authService.getProfile(claims.userId);
      if (!user) {
        clearSessionCookie(res);
        return res.json({ user: null });
      }

      return res.json({ user });
    } catch {
      clearSessionCookie(res);
      return res.json({ user: null });
    }
  });

  const requireAuth = createRequireAuth(container.authService);
  const requireAdmin = createRequireRole(["admin"]);

  app.get("/api/admin/health", requireAuth, requireAdmin, (req, res) => {
    const authReq = req as AuthenticatedRequest;
    res.json({
      ok: true,
      role: authReq.auth.role,
      persistenceMode: container.persistenceMode,
      aiMode: container.aiMode
    });
  });

  app.post("/api/ingest", requireAuth, async (req, res) => {
    const parsed = ingestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten()
      });
    }

    try {
      const authReq = req as AuthenticatedRequest;
      const record = await container.copilotService.ingest(authReq.auth.userId, parsed.data);
      return res.status(201).json(record);
    } catch (error) {
      handleError(res, error);
      return;
    }
  });

  app.get("/api/cases", requireAuth, async (req, res) => {
    const rawVertical =
      typeof req.query.vertical === "string" && req.query.vertical.length > 0
        ? req.query.vertical
        : undefined;

    if (rawVertical && rawVertical !== "scope-shield" && rawVertical !== "deal-pilot") {
      return res.status(400).json({ error: "Invalid vertical filter" });
    }

    try {
      const authReq = req as AuthenticatedRequest;
      const vertical = rawVertical as Vertical | undefined;
      const records = await container.copilotService.listCases(authReq.auth.userId, vertical);
      return res.json(records);
    } catch (error) {
      handleError(res, error);
      return;
    }
  });

  app.get("/api/cases/:caseId", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const caseId = Array.isArray(req.params.caseId) ? req.params.caseId[0] : req.params.caseId;
      const record = await container.copilotService.getCaseById(authReq.auth.userId, caseId);
      if (!record) {
        return res.status(404).json({ error: "Case not found" });
      }

      return res.json(record);
    } catch (error) {
      handleError(res, error);
      return;
    }
  });

  app.post("/api/cases/:caseId/actions/:actionId/execute", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const caseId = Array.isArray(req.params.caseId) ? req.params.caseId[0] : req.params.caseId;
      const actionId = Array.isArray(req.params.actionId) ? req.params.actionId[0] : req.params.actionId;
      const updatedRecord = await container.copilotService.executeAction(
        authReq.auth.userId,
        caseId,
        actionId
      );

      if (!updatedRecord) {
        return res.status(404).json({ error: "Case or action not found" });
      }

      return res.json(updatedRecord);
    } catch (error) {
      handleError(res, error);
      return;
    }
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: "Route not found",
      code: "NOT_FOUND"
    });
  });

  const publicPath = path.resolve(process.cwd(), "public");
  app.use(express.static(publicPath));

  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    handleError(res, error);
  });

  return app;
}
