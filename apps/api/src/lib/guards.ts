import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyAccess, type AccessClaims } from "./jwt";

declare module "fastify" {
  interface FastifyRequest {
    auth?: AccessClaims;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return reply.status(401).send({ code: "UNAUTHENTICATED", message: "Missing token" });
  }
  try {
    req.auth = verifyAccess(header.slice(7));
  } catch {
    return reply.status(401).send({ code: "UNAUTHENTICATED", message: "Invalid token" });
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (!req.auth?.isAdmin) {
    return reply.status(403).send({ code: "FORBIDDEN", message: "Admin only" });
  }
}
