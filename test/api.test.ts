import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

describe("API", () => {
  it("registers a user, authenticates, and creates a scope-shield case", async () => {
    const app = createApp();

    const registerResponse = await request(app).post("/api/auth/register").send({
      email: "alex@example.com",
      password: "pass12345",
      name: "Alex"
    });

    expect(registerResponse.status).toBe(201);
    const cookie = registerResponse.headers["set-cookie"][0];
    expect(cookie).toContain("lna_session=");

    const ingestResponse = await request(app)
      .post("/api/ingest")
      .set("Cookie", cookie)
      .send({
        vertical: "scope-shield",
        channel: "email",
        content:
          "Client asked for extra revisions and a new feature. Original project fee $3000. Please deliver before April 18.",
        context: {
          customerName: "Alex",
          counterparty: "Morgan"
        }
      });

    expect(ingestResponse.status).toBe(201);
    expect(ingestResponse.body.vertical).toBe("scope-shield");
    expect(ingestResponse.body.tasks.length).toBeGreaterThan(0);
    expect(ingestResponse.body.actions.length).toBeGreaterThan(0);
    expect(ingestResponse.body.createdAt).toBeDefined();
  });

  it("blocks protected endpoints without authentication", async () => {
    const app = createApp();

    const response = await request(app).post("/api/ingest").send({
      vertical: "deal-pilot",
      channel: "text",
      content:
        "Out-the-door price $32500, APR 9.4%, 72 months, doc fee $899 and protection package $1299"
    });

    expect(response.status).toBe(401);
  });

  it("returns JSON 404 for unknown API routes", async () => {
    const app = createApp();

    const response = await request(app).get("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: "Route not found",
      code: "NOT_FOUND"
    });
  });

  it("returns current session user from /api/auth/me", async () => {
    const app = createApp();

    const registerResponse = await request(app).post("/api/auth/register").send({
      email: "jamie@example.com",
      password: "pass12345",
      name: "Jamie"
    });

    const cookie = registerResponse.headers["set-cookie"][0];
    const meResponse = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.email).toBe("jamie@example.com");
    expect(meResponse.body.user.role).toBe("user");
  });

  it("denies admin endpoint for non-admin users", async () => {
    const app = createApp();

    const registerResponse = await request(app).post("/api/auth/register").send({
      email: "user@example.com",
      password: "pass12345",
      name: "User"
    });

    const cookie = registerResponse.headers["set-cookie"][0];
    const adminResponse = await request(app).get("/api/admin/health").set("Cookie", cookie);

    expect(adminResponse.status).toBe(403);
  });

  it("returns null user on /api/auth/me when session cookie is missing", async () => {
    const app = createApp();
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user: null });
  });

  it("validates register and login request payloads", async () => {
    const app = createApp();

    const badRegister = await request(app).post("/api/auth/register").send({
      email: "not-an-email",
      password: "short"
    });
    expect(badRegister.status).toBe(400);

    const badLogin = await request(app).post("/api/auth/login").send({
      email: "user@example.com"
    });
    expect(badLogin.status).toBe(400);
  });

  it("returns 404 for missing case and missing action", async () => {
    const app = createApp();

    const registerResponse = await request(app).post("/api/auth/register").send({
      email: "cases@example.com",
      password: "pass12345",
      name: "Cases"
    });

    const cookie = registerResponse.headers["set-cookie"][0];

    const missingCase = await request(app).get("/api/cases/missing-case").set("Cookie", cookie);
    expect(missingCase.status).toBe(404);

    const missingAction = await request(app)
      .post("/api/cases/missing-case/actions/missing-action/execute")
      .set("Cookie", cookie);
    expect(missingAction.status).toBe(404);
  });

  it("rejects invalid vertical filter on /api/cases", async () => {
    const app = createApp();

    const registerResponse = await request(app).post("/api/auth/register").send({
      email: "vertical@example.com",
      password: "pass12345",
      name: "Vertical"
    });
    const cookie = registerResponse.headers["set-cookie"][0];

    const response = await request(app)
      .get("/api/cases?vertical=invalid-vertical")
      .set("Cookie", cookie);

    expect(response.status).toBe(400);
  });
});
