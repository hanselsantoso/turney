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
  })
  .strip();
export type PublicUser = z.infer<typeof publicUser>;

export const authTokens = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: publicUser,
});
export type AuthTokens = z.infer<typeof authTokens>;
