import { z } from "zod";

export const tournamentStatus = z.enum([
  "draft",
  "reg_open",
  "reg_closed",
  "check_in",
  "in_progress",
  "completed",
]);
export type TournamentStatus = z.infer<typeof tournamentStatus>;

/* The one state machine. Server enforces; clients render from it. */
const TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  draft: ["reg_open"],
  reg_open: ["reg_closed"],
  reg_closed: ["check_in", "in_progress"],
  check_in: ["in_progress"],
  in_progress: ["completed"],
  completed: [],
};

export function canTransition(from: TournamentStatus, to: TournamentStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export const stageFormat = z.enum(["round_robin", "swiss", "single_elim", "double_elim"]);
export type StageFormat = z.infer<typeof stageFormat>;

export const stageScoring = z.enum(["win_loss", "points_accum"]);
export type StageScoring = z.infer<typeof stageScoring>;

export const stageInput = z.object({
  name: z.string().min(1).max(60),
  format: stageFormat,
  scoring: stageScoring,
  pointsConfig: z.record(z.string(), z.number()).nullish(),
  roundsPlanned: z.number().int().min(1).max(50).nullish(),
  advanceCount: z.number().int().min(1).nullish(),
});
export type StageInput = z.infer<typeof stageInput>;

export const prizePlace = z.object({
  place: z.number().int().min(1),
  prize: z.string().min(1).max(200),
});

export const createTournamentBody = z.object({
  communityId: z.string().uuid(),
  name: z.string().min(3).max(80),
  description: z.string().max(4000).nullish(),
  rules: z.string().max(8000).nullish(),
  bannerUrl: z.string().url().nullish(),
  prizePool: z.array(prizePlace).max(20).nullish(),
  maxParticipants: z.number().int().min(2).max(1024),
  entryFee: z.number().int().min(0),
  checkInEnabled: z.boolean().default(true),
  allowOnspotRegistration: z.boolean().default(true),
  startsAt: z.string().datetime(),
  stages: z.array(stageInput).min(1).max(10),
});
export type CreateTournamentBody = z.infer<typeof createTournamentBody>;

export const statusBody = z.object({ to: tournamentStatus });

export const createCommunityBody = z.object({
  name: z.string().min(3).max(60),
  city: z.string().max(80).nullish(),
  region: z.string().max(80).nullish(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullish(),
});
export type CreateCommunityBody = z.infer<typeof createCommunityBody>;

export const staffRole = z.enum(["organizer", "judge"]);
export const grantStaffBody = z.object({
  userId: z.string().uuid(),
  role: staffRole,
});

export const onspotRegisterBody = z.object({
  playerCode: z.string().min(4).max(12),
  cashAmount: z.number().int().min(0).nullish(),
});

export const movePlayerBody = z.object({
  registrationId: z.string().uuid(),
  toGroupId: z.string().uuid(),
  reason: z.string().max(300).nullish(),
});
