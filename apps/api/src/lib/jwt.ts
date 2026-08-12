import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

const SECRET = process.env.JWT_SECRET ?? "change_me_dev_only";

export type AccessClaims = { sub: string; isAdmin: boolean };

export function signAccess(user: { id: string; isAdmin: boolean }) {
  return jwt.sign({ sub: user.id, isAdmin: user.isAdmin }, SECRET, { expiresIn: "15m" });
}

export function signRefresh(user: { id: string }) {
  // jti guarantees every refresh token is unique even within the same second,
  // so rotation always invalidates the previous token's hash.
  return jwt.sign({ sub: user.id, typ: "refresh", jti: randomUUID() }, SECRET, {
    expiresIn: "30d",
  });
}

export function verifyAccess(token: string): AccessClaims {
  const p = jwt.verify(token, SECRET) as jwt.JwtPayload;
  if (p.typ === "refresh") throw new Error("refresh token used as access");
  return { sub: p.sub as string, isAdmin: Boolean(p.isAdmin) };
}

export function verifyRefresh(token: string): { sub: string } {
  const p = jwt.verify(token, SECRET) as jwt.JwtPayload;
  if (p.typ !== "refresh") throw new Error("not a refresh token");
  return { sub: p.sub as string };
}
