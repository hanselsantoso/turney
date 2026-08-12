import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuth } from "./auth";

const tokens = {
  accessToken: "acc",
  refreshToken: "ref",
  user: {
    id: "33333333-3333-4333-8333-333333333333",
    email: "gai@turney.id",
    displayName: "Gai",
    isAdmin: false,
    playerCode: "GAI-1003",
    elo: 1000,
  },
};

describe("auth store", () => {
  beforeEach(() => {
    useAuth.setState({ user: null, accessToken: null, refreshToken: null });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => tokens })),
    );
  });

  it("login stores user and tokens", async () => {
    await useAuth.getState().login("gai@turney.id", "pw-doesnt-matter");
    expect(useAuth.getState().user?.playerCode).toBe("GAI-1003");
    expect(useAuth.getState().accessToken).toBe("acc");
  });

  it("register stores user", async () => {
    await useAuth.getState().register("new@turney.id", "long-password-1", "Renji");
    expect(useAuth.getState().user?.displayName).toBe("Gai");
  });

  it("logout clears state", async () => {
    await useAuth.getState().login("gai@turney.id", "pw");
    useAuth.getState().logout();
    expect(useAuth.getState().user).toBeNull();
    expect(useAuth.getState().refreshToken).toBeNull();
  });
});
