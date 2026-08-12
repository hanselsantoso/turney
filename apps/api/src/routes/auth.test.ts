import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app";
import { truncateAll } from "../test/db";

const creds = {
  email: "gai@example.com",
  password: "xtreme-finish-3pts",
  displayName: "Gai",
};

describe("POST /auth/register", () => {
  beforeEach(truncateAll);

  it("creates a player and returns tokens", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/auth/register", payload: creds });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.isAdmin).toBe(false);
    expect(body.user.elo).toBe(1000);
    expect(body.user.playerCode).toMatch(/^GAI-\d{4}$/);
    expect(body.accessToken).toBeTypeOf("string");
    expect(body.refreshToken).toBeTypeOf("string");
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });

  it("409 on duplicate email", async () => {
    const app = buildApp();
    await app.inject({ method: "POST", url: "/auth/register", payload: creds });
    const res = await app.inject({ method: "POST", url: "/auth/register", payload: creds });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("EMAIL_TAKEN");
  });

  it("400 on invalid body", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "bad", password: "short", displayName: "" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /auth/login", () => {
  beforeEach(async () => {
    await truncateAll();
    await buildApp().inject({ method: "POST", url: "/auth/register", payload: creds });
  });

  it("returns tokens on correct credentials", async () => {
    const res = await buildApp().inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: creds.email, password: creds.password },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe(creds.email);
  });

  it("401 wrong password, same body as unknown email", async () => {
    const app = buildApp();
    const wrongPw = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: creds.email, password: "wrong-password-1" },
    });
    const unknown = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ghost@example.com", password: "wrong-password-1" },
    });
    expect(wrongPw.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrongPw.json()).toEqual(unknown.json());
  });
});

describe("refresh + logout", () => {
  beforeEach(truncateAll);

  async function register() {
    const res = await buildApp().inject({ method: "POST", url: "/auth/register", payload: creds });
    return res.json();
  }

  it("rotates refresh token and rejects reuse", async () => {
    const { refreshToken } = await register();
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken } });
    expect(res.statusCode).toBe(200);
    expect(res.json().refreshToken).not.toBe(refreshToken);
    const reuse = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken } });
    expect(reuse.statusCode).toBe(401);
  });

  it("logout invalidates refresh token", async () => {
    const { refreshToken } = await register();
    const app = buildApp();
    const out = await app.inject({ method: "POST", url: "/auth/logout", payload: { refreshToken } });
    expect(out.statusCode).toBe(204);
    const reuse = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken } });
    expect(reuse.statusCode).toBe(401);
  });
});
