import { describe, it, expect } from "vitest";
import { canTransition, createTournamentBody, tournamentStatus } from "./tournament";

describe("state machine", () => {
  it("allows the documented forward path", () => {
    expect(canTransition("draft", "reg_open")).toBe(true);
    expect(canTransition("reg_open", "reg_closed")).toBe(true);
    expect(canTransition("reg_closed", "check_in")).toBe(true);
    expect(canTransition("reg_closed", "in_progress")).toBe(true);
    expect(canTransition("check_in", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "completed")).toBe(true);
  });

  it("rejects skips and reversals", () => {
    expect(canTransition("draft", "in_progress")).toBe(false);
    expect(canTransition("reg_open", "draft")).toBe(false);
    expect(canTransition("completed", "in_progress")).toBe(false);
    expect(canTransition("draft", "completed")).toBe(false);
  });

  it("covers every status", () => {
    for (const s of tournamentStatus.options) {
      expect(() => canTransition(s, "completed")).not.toThrow();
    }
  });
});

describe("createTournamentBody", () => {
  const base = {
    communityId: "3f7e1a44-0000-4000-8000-000000000000",
    name: "SEKOCI Weekly #13",
    maxParticipants: 32,
    entryFee: 50000,
    startsAt: new Date().toISOString(),
    stages: [
      { name: "Round Robin", format: "round_robin", scoring: "points_accum", advanceCount: 2 },
      { name: "Double Elim", format: "double_elim", scoring: "win_loss" },
    ],
  };

  it("accepts a multi-stage tournament", () => {
    expect(createTournamentBody.safeParse(base).success).toBe(true);
  });

  it("requires at least one stage", () => {
    expect(createTournamentBody.safeParse({ ...base, stages: [] }).success).toBe(false);
  });

  it("rejects unknown stage format", () => {
    const bad = { ...base, stages: [{ name: "X", format: "ladder", scoring: "win_loss" }] };
    expect(createTournamentBody.safeParse(bad).success).toBe(false);
  });
});
