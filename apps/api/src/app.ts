import Fastify from "fastify";
import { authRoutes } from "./routes/auth";
import { communityRoutes } from "./routes/communities";
import { tournamentRoutes } from "./routes/tournaments";
import { registrationRoutes } from "./routes/registrations";
import { groupRoutes } from "./routes/groups";
import { matchRoutes } from "./routes/matches";
import { statsRoutes } from "./routes/stats";
import { deckRoutes } from "./routes/decks";
import { paymentRoutes } from "./routes/payments";

export function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" && !process.env.VITEST });

  /* Clients send content-type: application/json on bodyless POSTs (check-in,
     register). Treat an empty body as {} instead of a 400. */
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      if (body === "" || body == null) return done(null, {});
      try {
        done(null, JSON.parse(body as string));
      } catch (e) {
        done(e as Error, undefined);
      }
    },
  );

  app.get("/health", async () => ({ status: "ok" }));
  app.register(authRoutes);
  app.register(communityRoutes);
  app.register(tournamentRoutes);
  app.register(registrationRoutes);
  app.register(groupRoutes);
  app.register(matchRoutes);
  app.register(statsRoutes);
  app.register(deckRoutes);
  app.register(paymentRoutes);

  app.setErrorHandler((err, _req, reply) => {
    const e = err as { statusCode?: number; code?: string; message?: string };
    const status = typeof e.statusCode === "number" ? e.statusCode : 500;
    reply.status(status).send({
      code: e.code ?? "INTERNAL",
      message: status >= 500 ? "Internal server error" : e.message ?? "Error",
    });
  });

  return app;
}
