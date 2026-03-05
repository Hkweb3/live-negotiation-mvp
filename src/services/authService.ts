import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { appConfig } from "../config";
import { AppError } from "../lib/errors";
import { AuthRepository } from "../repositories/interfaces";
import { SessionClaims, UserProfile, UserRole } from "../types";

function toUserProfile(user: {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  createdAt: string;
}): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt
  };
}

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async register(input: { email: string; password: string; name?: string }): Promise<UserProfile> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.authRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new AppError("Email already registered", 409, "EMAIL_EXISTS");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const role: UserRole = appConfig.adminEmails.includes(normalizedEmail) ? "admin" : "user";

    const created = await this.authRepository.create({
      email: normalizedEmail,
      name: input.name,
      role,
      passwordHash
    });

    return toUserProfile(created);
  }

  async login(input: { email: string; password: string }): Promise<UserProfile> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await this.authRepository.findByEmail(normalizedEmail);

    if (!user) {
      throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
    }

    return toUserProfile(user);
  }

  async getProfile(userId: string): Promise<UserProfile | undefined> {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      return undefined;
    }

    return toUserProfile(user);
  }

  createSessionToken(profile: UserProfile): string {
    return jwt.sign(
      {
        sub: profile.id,
        email: profile.email,
        role: profile.role
      },
      appConfig.jwtSecret,
      {
        expiresIn: appConfig.sessionTtlSeconds
      }
    );
  }

  verifySessionToken(token: string): SessionClaims {
    try {
      const payload = jwt.verify(token, appConfig.jwtSecret) as jwt.JwtPayload;
      const userId = payload.sub;
      const email = payload.email;
      const role = payload.role;

      if (
        typeof userId !== "string" ||
        typeof email !== "string" ||
        (role !== "user" && role !== "admin")
      ) {
        throw new Error("Invalid token payload");
      }

      return {
        userId,
        email,
        role
      };
    } catch {
      throw new AppError("Invalid session", 401, "INVALID_SESSION");
    }
  }
}
