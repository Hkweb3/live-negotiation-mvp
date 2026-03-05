import { describe, expect, it } from "vitest";
import { InMemoryAuthRepository } from "../src/repositories/memoryAuthRepository";
import { AuthService } from "../src/services/authService";

describe("AuthService", () => {
  it("registers a user, normalizes email, and logs in", async () => {
    const service = new AuthService(new InMemoryAuthRepository());

    const user = await service.register({
      email: "  CASEY@Example.COM ",
      password: "pass12345",
      name: "Casey"
    });

    expect(user.email).toBe("casey@example.com");
    expect(user.role).toBe("user");

    const loggedIn = await service.login({
      email: "casey@example.com",
      password: "pass12345"
    });

    expect(loggedIn.id).toBe(user.id);
  });

  it("assigns admin role when email is in ADMIN_EMAILS", async () => {
    const service = new AuthService(new InMemoryAuthRepository());

    const user = await service.register({
      email: "admin@example.com",
      password: "pass12345"
    });

    expect(user.role).toBe("admin");
  });

  it("rejects duplicate registration and invalid login", async () => {
    const service = new AuthService(new InMemoryAuthRepository());
    await service.register({
      email: "sam@example.com",
      password: "pass12345"
    });

    await expect(
      service.register({
        email: "sam@example.com",
        password: "pass12345"
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "EMAIL_EXISTS"
    });

    await expect(
      service.login({
        email: "sam@example.com",
        password: "wrong-password"
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_CREDENTIALS"
    });
  });

  it("creates and verifies session token payload", async () => {
    const service = new AuthService(new InMemoryAuthRepository());

    const user = await service.register({
      email: "jordan@example.com",
      password: "pass12345"
    });

    const token = service.createSessionToken(user);
    const claims = service.verifySessionToken(token);

    expect(claims.userId).toBe(user.id);
    expect(claims.email).toBe("jordan@example.com");
    expect(claims.role).toBe("user");
  });
});
