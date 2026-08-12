import { describe, it, expect } from "vitest";
import { buildApp } from "./app";

describe("app", () => {
  it("responds to health check", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});

describe("empty json body", () => {
  it("bodyless POST with json content-type is not a 400", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/registrations/check-in",
      headers: { "content-type": "application/json" },
    });
    /* 401 (no auth) proves the parser accepted the empty body */
    expect(res.statusCode).toBe(401);
  });
});
