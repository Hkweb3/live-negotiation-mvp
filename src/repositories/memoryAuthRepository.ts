import { randomUUID } from "node:crypto";
import { AppError } from "../lib/errors";
import { AuthRepository, CreateUserInput } from "./interfaces";
import { UserRecord } from "../types";

export class InMemoryAuthRepository implements AuthRepository {
  private readonly usersById = new Map<string, UserRecord>();
  private readonly userIdByEmail = new Map<string, string>();

  async create(input: CreateUserInput): Promise<UserRecord> {
    const normalizedEmail = input.email.trim().toLowerCase();
    if (this.userIdByEmail.has(normalizedEmail)) {
      throw new AppError("Email already registered", 409, "EMAIL_EXISTS");
    }

    const now = new Date().toISOString();
    const user: UserRecord = {
      id: randomUUID(),
      email: normalizedEmail,
      name: input.name,
      role: input.role,
      passwordHash: input.passwordHash,
      createdAt: now,
      updatedAt: now
    };

    this.usersById.set(user.id, user);
    this.userIdByEmail.set(normalizedEmail, user.id);

    return user;
  }

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    const normalizedEmail = email.trim().toLowerCase();
    const userId = this.userIdByEmail.get(normalizedEmail);
    if (!userId) {
      return undefined;
    }

    return this.usersById.get(userId);
  }

  async findById(id: string): Promise<UserRecord | undefined> {
    return this.usersById.get(id);
  }
}
