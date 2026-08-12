import { describe, it, expect } from "vitest";
import { registerBody, publicUser } from "./auth";

describe("auth schemas", () => {
  it("accepts valid registration", () => {
    const r = registerBody.safeParse({
      email: "blader@example.com",
      password: "hunter2hunter2",
      displayName: "Blader Gai",
    });
    expect(r.success).toBe(true);
  });

  it("rejects short password", () => {
    const r = registerBody.safeParse({
      email: "blader@example.com",
      password: "short",
      displayName: "Blader Gai",
    });
    expect(r.success).toBe(false);
  });

  it("publicUser never leaks passwordHash", () => {
    const r = publicUser.safeParse({
      id: "3f7e1a44-0000-4000-8000-000000000000",
      email: "a@b.co",
      displayName: "X",
      isAdmin: false,
      playerCode: "X-0001",
      elo: 1000,
      passwordHash: "leak",
    });
    expect(r.success).toBe(true);
    if (r.success) expect("passwordHash" in r.data).toBe(false);
  });
});
