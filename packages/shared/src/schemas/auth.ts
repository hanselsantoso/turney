import { z } from "zod";

export const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  displayName: z.string().min(2).max(40),
});
export type RegisterBody = z.infer<typeof registerBody>;

export const loginBody = z.object({
  email: z.string().email(),
  password: z.string(),
});
export type LoginBody = z.infer<typeof loginBody>;

export const publicUser = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    displayName: z.string(),
    isAdmin: z.boolean(),
    playerCode: z.string(),
    elo: z.number().int(),
    city: z.string().nullish(),
    region: z.string().nullish(),
    onboardedAt: z.coerce.string().nullish(),
  })
  .strip();
export type PublicUser = z.infer<typeof publicUser>;

/* Onboarding: everything optional, everything skippable. */
export const updateMeBody = z.object({
  city: z.string().max(80).nullish(),
  region: z.string().max(80).nullish(),
  birthYear: z.number().int().min(1940).max(2022).nullish(),
  gender: z.string().max(40).nullish(),
  avatarUrl: z.string().max(300).nullish(),
  onboarded: z.boolean().nullish(),
});
export type UpdateMeBody = z.infer<typeof updateMeBody>;

export const authTokens = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: publicUser,
});
export type AuthTokens = z.infer<typeof authTokens>;
