import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { PrismaAuthRepository } from "../src/repositories/prismaAuthRepository";

describe("PrismaAuthRepository", () => {
  const create = vi.fn();
  const findUnique = vi.fn();

  const prisma: {
    user: {
      create: typeof create;
      findUnique: typeof findUnique;
    };
  } = {
    user: {
      create,
      findUnique
    }
  };

  beforeEach(() => {
    create.mockReset();
    findUnique.mockReset();
  });

  it("creates user and normalizes email", async () => {
    create.mockResolvedValue({
      id: "u1",
      email: "test@example.com",
      name: "Test",
      role: "user",
      passwordHash: "hash",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z")
    });

    const repo = new PrismaAuthRepository(prisma as unknown as PrismaClient);
    const result = await repo.create({
      email: "  TEST@EXAMPLE.COM ",
      name: "Test",
      role: "user",
      passwordHash: "hash"
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "test@example.com"
        })
      })
    );
    expect(result.email).toBe("test@example.com");
  });

  it("finds users by email and id", async () => {
    const userRecord = {
      id: "u2",
      email: "jamie@example.com",
      name: null,
      role: "admin",
      passwordHash: "hash",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z")
    };
    findUnique.mockResolvedValue(userRecord);

    const repo = new PrismaAuthRepository(prisma as unknown as PrismaClient);
    const byEmail = await repo.findByEmail("JAMIE@EXAMPLE.COM");
    expect(byEmail?.email).toBe("jamie@example.com");

    const byId = await repo.findById("u2");
    expect(byId?.id).toBe("u2");
  });
});
