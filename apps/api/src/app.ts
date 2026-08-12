import Fastify from "fastify";
import { authRoutes } from "./routes/auth";
import { communityRoutes } from "./routes/communities";
import { tournamentRoutes } from "./routes/tournaments";
import { registrationRoutes } from "./routes/registrations";

export function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" && !process.env.VITEST });

  app.get("/health", async () => ({ status: "ok" }));
  app.register(authRoutes);
  app.register(communityRoutes);
  app.register(tournamentRoutes);
  app.register(registrationRoutes);

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
