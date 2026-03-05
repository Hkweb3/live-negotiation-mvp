import { NextFunction, Request, Response } from "express";
import { appConfig } from "../config";
import { AppError } from "../lib/errors";
import { AuthService } from "../services/authService";
import { SessionClaims, UserRole } from "../types";

export interface AuthenticatedRequest extends Request {
  auth: SessionClaims;
}

export function createRequireAuth(authService: AuthService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = req.cookies?.[appConfig.sessionCookieName];
    if (!token || typeof token !== "string") {
      next(new AppError("Authentication required", 401, "AUTH_REQUIRED"));
      return;
    }

    const claims = authService.verifySessionToken(token);
    (req as AuthenticatedRequest).auth = claims;
    next();
  };
}

export function createRequireRole(roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      next(new AppError("Authentication required", 401, "AUTH_REQUIRED"));
      return;
    }

    if (!roles.includes(auth.role)) {
      next(new AppError("Forbidden", 403, "FORBIDDEN"));
      return;
    }

    next();
  };
}
