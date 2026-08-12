import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { registerBody, loginBody, publicUser } from "@turney/shared";
import { db } from "../db/client";
import { users } from "../db/schema";
import { signAccess, signRefresh, verifyRefresh } from "../lib/jwt";
import { makePlayerCode } from "../lib/playerCode";

const refreshBody = z.object({ refreshToken: z.string() });

function toPublic(user: typeof users.$inferSelect) {
  return publicUser.parse({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
    playerCode: user.playerCode,
    elo: user.elo,
    city: user.city,
  });
}

async function issueTokens(user: typeof users.$inferSelect) {
  const refreshToken = signRefresh(user);
  await db
    .update(users)
    .set({ refreshTokenHash: await argon2.hash(refreshToken) })
    .where(eq(users.id, user.id));
  return { accessToken: signAccess(user), refreshToken, user: toPublic(user) };
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (req, reply) => {
    const parsed = registerBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        code: "VALIDATION",
        message: "Invalid body",
        details: parsed.error.flatten(),
      });
    }
    const { email, password, displayName } = parsed.data;

    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing.length > 0) {
      return reply.status(409).send({ code: "EMAIL_TAKEN", message: "Email already registered" });
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    let user: typeof users.$inferSelect | undefined;
    for (let attempt = 0; attempt < 5 && !user; attempt++) {
      try {
        [user] = await db
          .insert(users)
          .values({ email, passwordHash, displayName, playerCode: makePlayerCode(displayName) })
          .returning();
      } catch (e) {
        // player_code collision: retry with a new random code
        if (attempt === 4) throw e;
      }
    }
    return reply.status(201).send(await issueTokens(user!));
  });

  app.post("/auth/login", async (req, reply) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "VALIDATION", message: "Invalid body" });
    }
    const fail = () =>
      reply.status(401).send({ code: "BAD_CREDENTIALS", message: "Wrong email or password" });

    const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email));
    if (!user) return fail();
    const ok = await argon2.verify(user.passwordHash, parsed.data.password);
    if (!ok) return fail();

    return reply.send(await issueTokens(user));
  });

  app.post("/auth/refresh", async (req, reply) => {
    const parsed = refreshBody.safeParse(req.body);
    if (!parsed.success)
      return reply.status(400).send({ code: "VALIDATION", message: "Invalid body" });
    const deny = () =>
      reply.status(401).send({ code: "BAD_REFRESH", message: "Invalid refresh token" });

    let sub: string;
    try {
      sub = verifyRefresh(parsed.data.refreshToken).sub;
    } catch {
      return deny();
    }
    const [user] = await db.select().from(users).where(eq(users.id, sub));
    if (!user?.refreshTokenHash) return deny();
    const match = await argon2.verify(user.refreshTokenHash, parsed.data.refreshToken);
    if (!match) return deny();

    return reply.send(await issueTokens(user));
  });

  app.post("/auth/logout", async (req, reply) => {
    const parsed = refreshBody.safeParse(req.body);
    if (!parsed.success)
      return reply.status(400).send({ code: "VALIDATION", message: "Invalid body" });
    try {
      const { sub } = verifyRefresh(parsed.data.refreshToken);
      await db.update(users).set({ refreshTokenHash: null }).where(eq(users.id, sub));
    } catch {
      // invalid token: nothing to invalidate; logout stays idempotent
    }
    return reply.status(204).send();
  });
}
