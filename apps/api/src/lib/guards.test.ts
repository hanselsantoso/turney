import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { requireAuth, requireAdmin } from "./guards";
import { signAccess } from "./jwt";

function appWithGuardedRoute() {
  const app = Fastify();
  app.get("/admin-only", { preHandler: [requireAuth, requireAdmin] }, async (req) => ({
    caller: req.auth!.sub,
  }));
  return app;
}

describe("guards", () => {
  it("401 without token", async () => {
    const res = await appWithGuardedRoute().inject({ method: "GET", url: "/admin-only" });
    expect(res.statusCode).toBe(401);
  });

  it("403 for non-admin", async () => {
    const token = signAccess({ id: "11111111-1111-4111-8111-111111111111", isAdmin: false });
    const res = await appWithGuardedRoute().inject({
      method: "GET",
      url: "/admin-only",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("200 for admin", async () => {
    const token = signAccess({ id: "22222222-2222-4222-8222-222222222222", isAdmin: true });
    const res = await appWithGuardedRoute().inject({
      method: "GET",
      url: "/admin-only",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().caller).toBe("22222222-2222-4222-8222-222222222222");
  });
});
