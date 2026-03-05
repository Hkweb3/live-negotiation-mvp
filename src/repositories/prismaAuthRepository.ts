import { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../lib/errors";
import { UserRecord } from "../types";
import { AuthRepository, CreateUserInput } from "./interfaces";

function toUserRecord(user: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}): UserRecord {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? undefined,
    role: user.role as UserRecord["role"],
    passwordHash: user.passwordHash,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateUserInput): Promise<UserRecord> {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email.trim().toLowerCase(),
          name: input.name,
          role: input.role,
          passwordHash: input.passwordHash
        }
      });

      return toUserRecord(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError("Email already registered", 409, "EMAIL_EXISTS");
      }

      throw error;
    }
  }

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }
    });

    return user ? toUserRecord(user) : undefined;
  }

  async findById(id: string): Promise<UserRecord | undefined> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? toUserRecord(user) : undefined;
  }
}
