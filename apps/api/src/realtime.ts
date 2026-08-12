import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import { verifyAccess } from "./lib/jwt";

/* Room per tournament. Events carry IDs only; clients refetch via REST. */
export function attachRealtime(app: FastifyInstance) {
  const io = new Server(app.server, { cors: { origin: true } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(); // spectators allowed read-only
    try {
      socket.data.auth = verifyAccess(token);
      next();
    } catch {
      next(new Error("bad token"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join", (tournamentId: string) => {
      if (typeof tournamentId === "string" && tournamentId.length < 64) {
        socket.join(`tournament:${tournamentId}`);
      }
    });
    socket.on("leave", (tournamentId: string) => {
      socket.leave(`tournament:${tournamentId}`);
    });
  });

  app.io = io;
  app.addHook("onClose", async () => {
    await io.close();
  });
}
