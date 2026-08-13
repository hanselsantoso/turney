import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app";
import { truncateAll } from "../test/db";

describe("PATCH /users/me (onboarding)", () => {
  beforeEach(truncateAll);

  it("saves demographics and stamps onboardedAt once flagged", async () => {
    const app = buildApp();
    const session = (
      await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          email: "renji@turney.id",
          password: "long-enough-password",
          displayName: "Renji",
        },
      })
    ).json();
    expect(session.user.onboardedAt ?? null).toBeNull();

    const res = await app.inject({
      method: "PATCH",
      url: "/users/me",
      headers: { authorization: `Bearer ${session.accessToken}` },
      payload: {
        city: "Jakarta Selatan",
        region: "DKI Jakarta",
        birthYear: 2004,
        onboarded: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const me = res.json();
    expect(me.city).toBe("Jakarta Selatan");
    expect(me.onboardedAt).toBeTruthy();

    /* skippable fields stay untouched on partial patch */
    const res2 = await app.inject({
      method: "PATCH",
      url: "/users/me",
      headers: { authorization: `Bearer ${session.accessToken}` },
      payload: { gender: "male" },
    });
    expect(res2.json().city).toBe("Jakarta Selatan");
  });
});
