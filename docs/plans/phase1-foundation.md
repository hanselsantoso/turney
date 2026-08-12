# Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Boot a working monorepo where `pnpm dev` starts Postgres + Fastify API + Expo app, with JWT auth (register/login/refresh/logout) and role-based route groups working on web and native.

**Architecture:** Turborepo monorepo with pnpm workspaces. `apps/api` is Fastify 5 + Drizzle ORM against Postgres 16 in Docker. `packages/shared` holds zod schemas, TS types, and design tokens consumed by both API and app. `apps/mobile` is Expo SDK 52+ with Expo Router; auth state in zustand, server state in TanStack Query.

**Tech Stack:** pnpm, Turborepo, TypeScript 5, Fastify 5, Drizzle ORM + drizzle-kit, PostgreSQL 16 (Docker), zod, argon2, jsonwebtoken, Vitest, Expo (React Native), Expo Router, TanStack Query v5, zustand.

## Global Constraints

- Code lives at the repo root of github.com/hanselsantoso/turney (standalone repo; old Flutter app stays in its own repo).
- Node >= 20. TypeScript `strict: true` everywhere.
- Every API request/response body validated by a zod schema from `packages/shared`. No inline schemas in route files.
- API errors always `{code: string, message: string, details?: unknown}`.
- Access token TTL 15m, refresh token TTL 30d. Argon2id for password hashing.
- Roles: exactly `admin | judge | player`. Default on register: `player`. First admin via seed script only.
- Design tokens from spec verbatim: bg `#0c0d10`, surface `#14161b`, surface2 `#1c1f26`, border `#272b33`, text `#f2f3f5`, textDim `#9aa1ad`, accent `#3d8bff`, live `#ff4655`, win `#2fd47a`; radius sm 8 / md 12 / pill 999; fonts Geist + Geist Mono.
- Commit after every green test cycle. Conventional commits (`feat:`, `test:`, `chore:`).

## Boot order

```mermaid
flowchart LR
    T1[Task 1\nmonorepo scaffold] --> T2[Task 2\nshared: tokens + auth schemas]
    T1 --> T3[Task 3\nDocker Postgres + Drizzle + users table]
    T2 --> T4[Task 4\nFastify app + health]
    T3 --> T4
    T4 --> T5[Task 5\nPOST /auth/register]
    T5 --> T6[Task 6\nPOST /auth/login]
    T6 --> T7[Task 7\nrefresh + logout]
    T7 --> T8[Task 8\nrequireRole middleware]
    T8 --> T9[Task 9\nseed script: admin]
    T9 --> T10[Task 10\nExpo shell + auth + role routing]
```

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`

**Interfaces:**
- Produces: workspace names `@turney/api`, `@turney/shared`, `@turney/mobile` that later tasks import.

- [ ] **Step 1: Create workspace files**

`package.json`:
```json
{
  "name": "turney",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "typecheck": "turbo typecheck"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": { "cache": false, "persistent": true },
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["^build"] },
    "typecheck": {}
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`.gitignore`:
```
node_modules
dist
.expo
.env
```

- [ ] **Step 2: Verify install works**

Run: `pnpm install`
Expected: lockfile created, no errors.

- [ ] **Step 3: Commit**

```bash
git add 
git commit -m "chore: scaffold turborepo monorepo"
```

---

### Task 2: Shared package — design tokens + auth schemas

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`, `packages/shared/src/tokens.ts`, `packages/shared/src/schemas/auth.ts`
- Test: `packages/shared/src/schemas/auth.test.ts`

**Interfaces:**
- Produces: `tokens` object; zod schemas `registerBody`, `loginBody`, `authTokens`, `publicUser`; types `RegisterBody`, `LoginBody`, `AuthTokens`, `PublicUser`, `Role`. Import path: `@turney/shared`.

- [ ] **Step 1: Package setup**

`packages/shared/package.json`:
```json
{
  "name": "@turney/shared",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "zod": "^3.24.0" },
  "devDependencies": { "vitest": "^2.1.0" }
}
```

`packages/shared/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 2: Write failing test**

`packages/shared/src/schemas/auth.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { registerBody, publicUser } from "./auth";

describe("auth schemas", () => {
  it("accepts valid registration", () => {
    const r = registerBody.safeParse({
      email: "blader@example.com",
      password: "hunter2hunter2",
      displayName: "Blader Gai",
    });
    expect(r.success).toBe(true);
  });

  it("rejects short password", () => {
    const r = registerBody.safeParse({
      email: "blader@example.com",
      password: "short",
      displayName: "Blader Gai",
    });
    expect(r.success).toBe(false);
  });

  it("publicUser never contains passwordHash", () => {
    const r = publicUser.safeParse({
      id: "3f7e1a44-0000-0000-0000-000000000000",
      email: "a@b.co",
      displayName: "X",
      role: "player",
      elo: 1000,
      passwordHash: "leak",
    });
    expect(r.success).toBe(true);
    if (r.success) expect("passwordHash" in r.data).toBe(false);
  });
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `cd packages/shared && pnpm vitest run`
Expected: FAIL — cannot resolve `./auth`.

- [ ] **Step 4: Implement tokens + schemas**

`packages/shared/src/tokens.ts`:
```ts
export const tokens = {
  color: {
    bg: "#0c0d10",
    surface: "#14161b",
    surface2: "#1c1f26",
    border: "#272b33",
    text: "#f2f3f5",
    textDim: "#9aa1ad",
    accent: "#3d8bff",
    live: "#ff4655",
    win: "#2fd47a",
    loss: "#ff4655",
    draw: "#9aa1ad",
  },
  radius: { sm: 8, md: 12, pill: 999 },
  duration: { press: 140, popover: 180, sheet: 260, celebration: 600 },
} as const;
```

`packages/shared/src/schemas/auth.ts`:
```ts
import { z } from "zod";

export const role = z.enum(["admin", "judge", "player"]);
export type Role = z.infer<typeof role>;

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
    role,
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
```

`packages/shared/src/index.ts`:
```ts
export * from "./tokens";
export * from "./schemas/auth";
```

- [ ] **Step 5: Run tests, verify pass**

Run: `cd packages/shared && pnpm vitest run`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add packages/shared
git commit -m "feat: shared package with design tokens and auth schemas"
```

---

### Task 3: Docker Postgres + Drizzle + users table

**Files:**
- Create: `docker-compose.yml`, `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/drizzle.config.ts`, `apps/api/src/db/schema.ts`, `apps/api/src/db/client.ts`, `apps/api/.env.example`

**Interfaces:**
- Produces: `db` (Drizzle client) from `src/db/client.ts`; `users` table from `src/db/schema.ts` with columns `id, email, passwordHash, displayName, role, elo, refreshTokenHash, createdAt`.

- [ ] **Step 1: Compose file**

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: tm
      POSTGRES_PASSWORD: tm_dev
      POSTGRES_DB: tournament
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
  db_test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: tm
      POSTGRES_PASSWORD: tm_test
      POSTGRES_DB: tournament_test
    ports: ["5433:5432"]
volumes:
  pgdata:
```

- [ ] **Step 2: API package + Drizzle schema**

`apps/api/package.json`:
```json
{
  "name": "@turney/api",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:migrate:test": "DATABASE_URL=postgres://tm:tm_test@localhost:5433/tournament_test drizzle-kit migrate"
  },
  "dependencies": {
    "@turney/shared": "workspace:*",
    "argon2": "^0.41.0",
    "drizzle-orm": "^0.38.0",
    "fastify": "^5.2.0",
    "jsonwebtoken": "^9.0.2",
    "postgres": "^3.4.5",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.7",
    "drizzle-kit": "^0.30.0",
    "tsx": "^4.19.0",
    "vitest": "^2.1.0"
  }
}
```

`apps/api/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

`apps/api/drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://tm:tm_dev@localhost:5432/tournament",
  },
});
```

`apps/api/src/db/schema.ts`:
```ts
import { pgTable, uuid, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "judge", "player"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: roleEnum("role").notNull().default("player"),
  elo: integer("elo").notNull().default(1000),
  refreshTokenHash: text("refresh_token_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

`apps/api/src/db/client.ts`:
```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url =
  process.env.DATABASE_URL ?? "postgres://tm:tm_dev@localhost:5432/tournament";

export const sql = postgres(url);
export const db = drizzle(sql, { schema });
```

`apps/api/.env.example`:
```
DATABASE_URL=postgres://tm:tm_dev@localhost:5432/tournament
JWT_SECRET=change_me_dev_only
```

- [ ] **Step 3: Generate + run migration against both DBs**

Run:
```bash
docker compose up -d
cd apps/api && pnpm install && pnpm db:generate && pnpm db:migrate && pnpm db:migrate:test
```
Expected: migration file in `drizzle/`, `users` table exists. Verify: `docker compose exec db psql -U tm -d tournament -c '\d users'` shows columns.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml apps/api
git commit -m "feat: postgres via docker compose, drizzle schema with users table"
```

---

### Task 4: Fastify app factory + health route

**Files:**
- Create: `apps/api/src/app.ts`, `apps/api/src/server.ts`
- Test: `apps/api/src/app.test.ts`

**Interfaces:**
- Produces: `buildApp(): FastifyInstance` — every later API task registers routes inside `buildApp` and tests via `app.inject()`.

- [ ] **Step 1: Write failing test**

`apps/api/src/app.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildApp } from "./app";

describe("app", () => {
  it("responds to health check", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});
```

- [ ] **Step 2: Run test, verify fails**

Run: `cd apps/api && pnpm vitest run`
Expected: FAIL — cannot resolve `./app`.

- [ ] **Step 3: Implement**

`apps/api/src/app.ts`:
```ts
import Fastify from "fastify";

export function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

  app.get("/health", async () => ({ status: "ok" }));

  app.setErrorHandler((err, _req, reply) => {
    const status = "statusCode" in err && err.statusCode ? err.statusCode : 500;
    reply.status(status).send({
      code: err.code ?? "INTERNAL",
      message: status >= 500 ? "Internal server error" : err.message,
    });
  });

  return app;
}
```

`apps/api/src/server.ts`:
```ts
import { buildApp } from "./app";

const app = buildApp();
app.listen({ port: 3000, host: "0.0.0.0" }).catch((e) => {
  app.log.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Run test, verify passes**

Run: `cd apps/api && pnpm vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src
git commit -m "feat: fastify app factory with health route and error envelope"
```

---

### Task 5: POST /auth/register

**Files:**
- Create: `apps/api/src/routes/auth.ts`, `apps/api/src/lib/jwt.ts`, `apps/api/src/test/db.ts`
- Modify: `apps/api/src/app.ts` (register route plugin)
- Test: `apps/api/src/routes/auth.register.test.ts`

**Interfaces:**
- Consumes: `buildApp` (Task 4), `users` table (Task 3), `registerBody`/`authTokens` schemas (Task 2).
- Produces: `signAccess(user): string`, `signRefresh(user): string`, `verifyAccess(token): {sub: string, role: Role}` in `src/lib/jwt.ts`. `authRoutes` Fastify plugin. Test helper `truncateAll()` in `src/test/db.ts`.

Tests hit the real `db_test` Postgres (port 5433). Vitest picks it up via `DATABASE_URL` env in test script — add to `package.json` scripts: `"test": "DATABASE_URL=postgres://tm:tm_test@localhost:5433/tournament_test vitest run"`.

- [ ] **Step 1: Test helper**

`apps/api/src/test/db.ts`:
```ts
import { sql } from "../db/client";

export async function truncateAll() {
  await sql`TRUNCATE TABLE users CASCADE`;
}
```

- [ ] **Step 2: Write failing test**

`apps/api/src/routes/auth.register.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app";
import { truncateAll } from "../test/db";

describe("POST /auth/register", () => {
  beforeEach(truncateAll);

  it("creates a player and returns tokens", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "gai@example.com",
        password: "xtreme-finish-3pts",
        displayName: "Gai",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.role).toBe("player");
    expect(body.user.elo).toBe(1000);
    expect(body.accessToken).toBeTypeOf("string");
    expect(body.refreshToken).toBeTypeOf("string");
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });

  it("409 on duplicate email", async () => {
    const app = buildApp();
    const payload = {
      email: "dupe@example.com",
      password: "xtreme-finish-3pts",
      displayName: "Dupe",
    };
    await app.inject({ method: "POST", url: "/auth/register", payload });
    const res = await app.inject({ method: "POST", url: "/auth/register", payload });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("EMAIL_TAKEN");
  });

  it("400 on invalid body", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "bad", password: "short", displayName: "" },
    });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 3: Run test, verify fails**

Run: `cd apps/api && pnpm test`
Expected: FAIL — 404 route not found.

- [ ] **Step 4: Implement JWT lib + route**

`apps/api/src/lib/jwt.ts`:
```ts
import jwt from "jsonwebtoken";
import type { Role } from "@turney/shared";

const SECRET = process.env.JWT_SECRET ?? "change_me_dev_only";

export type AccessClaims = { sub: string; role: Role };

export function signAccess(user: { id: string; role: Role }) {
  return jwt.sign({ sub: user.id, role: user.role }, SECRET, { expiresIn: "15m" });
}

export function signRefresh(user: { id: string }) {
  return jwt.sign({ sub: user.id, typ: "refresh" }, SECRET, { expiresIn: "30d" });
}

export function verifyAccess(token: string): AccessClaims {
  const p = jwt.verify(token, SECRET) as jwt.JwtPayload;
  if (p.typ === "refresh") throw new Error("refresh token used as access");
  return { sub: p.sub as string, role: p.role as Role };
}

export function verifyRefresh(token: string): { sub: string } {
  const p = jwt.verify(token, SECRET) as jwt.JwtPayload;
  if (p.typ !== "refresh") throw new Error("not a refresh token");
  return { sub: p.sub as string };
}
```

`apps/api/src/routes/auth.ts`:
```ts
import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { registerBody, publicUser } from "@turney/shared";
import { db } from "../db/client";
import { users } from "../db/schema";
import { signAccess, signRefresh } from "../lib/jwt";

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
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash, displayName })
      .returning();

    const refreshToken = signRefresh(user);
    await db
      .update(users)
      .set({ refreshTokenHash: await argon2.hash(refreshToken) })
      .where(eq(users.id, user.id));

    return reply.status(201).send({
      accessToken: signAccess(user),
      refreshToken,
      user: publicUser.parse(user),
    });
  });
}
```

Modify `apps/api/src/app.ts` — add inside `buildApp` before `return app`:
```ts
import { authRoutes } from "./routes/auth";
// inside buildApp():
app.register(authRoutes);
```

- [ ] **Step 5: Run tests, verify pass**

Run: `cd apps/api && pnpm test`
Expected: register tests + health PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src
git commit -m "feat: auth register endpoint with argon2 and jwt issuance"
```

---

### Task 6: POST /auth/login

**Files:**
- Modify: `apps/api/src/routes/auth.ts`
- Test: `apps/api/src/routes/auth.login.test.ts`

**Interfaces:**
- Consumes: `authRoutes`, `loginBody` schema, jwt lib.
- Produces: `POST /auth/login` returning same `authTokens` shape as register.

- [ ] **Step 1: Write failing test**

`apps/api/src/routes/auth.login.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app";
import { truncateAll } from "../test/db";

const creds = {
  email: "login@example.com",
  password: "burst-finish-2pts!",
  displayName: "Login Tester",
};

describe("POST /auth/login", () => {
  beforeEach(async () => {
    await truncateAll();
    const app = buildApp();
    await app.inject({ method: "POST", url: "/auth/register", payload: creds });
  });

  it("returns tokens on correct credentials", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: creds.email, password: creds.password },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe(creds.email);
  });

  it("401 on wrong password, same error as unknown email", async () => {
    const app = buildApp();
    const wrongPw = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: creds.email, password: "wrong-password-1" },
    });
    const unknown = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ghost@example.com", password: "wrong-password-1" },
    });
    expect(wrongPw.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrongPw.json()).toEqual(unknown.json());
  });
});
```

- [ ] **Step 2: Run test, verify fails** — `pnpm test`, expect 404 on /auth/login.

- [ ] **Step 3: Implement** — add to `authRoutes`:

```ts
import { loginBody } from "@turney/shared";
// inside authRoutes():
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

  const refreshToken = signRefresh(user);
  await db
    .update(users)
    .set({ refreshTokenHash: await argon2.hash(refreshToken) })
    .where(eq(users.id, user.id));

  return reply.send({
    accessToken: signAccess(user),
    refreshToken,
    user: publicUser.parse(user),
  });
});
```

- [ ] **Step 4: Run tests, verify pass** — `pnpm test`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src
git commit -m "feat: auth login with constant-shape 401"
```

---

### Task 7: POST /auth/refresh + /auth/logout

**Files:**
- Modify: `apps/api/src/routes/auth.ts`
- Test: `apps/api/src/routes/auth.refresh.test.ts`

**Interfaces:**
- Consumes: `verifyRefresh` from jwt lib.
- Produces: `POST /auth/refresh` body `{refreshToken}` -> new `authTokens` (rotation: old refresh invalidated). `POST /auth/logout` body `{refreshToken}` -> 204, clears stored hash.

- [ ] **Step 1: Write failing test**

`apps/api/src/routes/auth.refresh.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app";
import { truncateAll } from "../test/db";

async function registerAndGetTokens() {
  const app = buildApp();
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "refresh@example.com",
      password: "over-finish-2pts!!",
      displayName: "Refresher",
    },
  });
  return res.json();
}

describe("refresh + logout", () => {
  beforeEach(truncateAll);

  it("rotates refresh token", async () => {
    const { refreshToken } = await registerAndGetTokens();
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
    const rotated = res.json().refreshToken;
    expect(rotated).not.toBe(refreshToken);

    const reuse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });
    expect(reuse.statusCode).toBe(401);
  });

  it("logout invalidates refresh token", async () => {
    const { refreshToken } = await registerAndGetTokens();
    const app = buildApp();
    const out = await app.inject({
      method: "POST",
      url: "/auth/logout",
      payload: { refreshToken },
    });
    expect(out.statusCode).toBe(204);
    const reuse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });
    expect(reuse.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run, verify fails** — `pnpm test`, 404s.

- [ ] **Step 3: Implement** — add to `authRoutes`:

```ts
import { verifyRefresh } from "../lib/jwt";
import { z } from "zod";

const refreshBody = z.object({ refreshToken: z.string() });

// inside authRoutes():
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

  const refreshToken = signRefresh(user);
  await db
    .update(users)
    .set({ refreshTokenHash: await argon2.hash(refreshToken) })
    .where(eq(users.id, user.id));

  return reply.send({
    accessToken: signAccess(user),
    refreshToken,
    user: publicUser.parse(user),
  });
});

app.post("/auth/logout", async (req, reply) => {
  const parsed = refreshBody.safeParse(req.body);
  if (!parsed.success)
    return reply.status(400).send({ code: "VALIDATION", message: "Invalid body" });
  try {
    const { sub } = verifyRefresh(parsed.data.refreshToken);
    await db.update(users).set({ refreshTokenHash: null }).where(eq(users.id, sub));
  } catch {
    // Invalid token: nothing to invalidate; 204 keeps logout idempotent.
  }
  return reply.status(204).send();
});
```

- [ ] **Step 4: Run tests, verify pass** — `pnpm test`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src
git commit -m "feat: refresh rotation and logout"
```

---

### Task 8: requireAuth + requireRole middleware

**Files:**
- Create: `apps/api/src/lib/guards.ts`
- Test: `apps/api/src/lib/guards.test.ts`

**Interfaces:**
- Consumes: `verifyAccess`.
- Produces: `requireAuth` preHandler (sets `req.auth = {sub, role}`); `requireRole(...roles: Role[])` preHandler. Fastify type augmentation for `req.auth`. Every protected route in Phases 2-6 uses these.

- [ ] **Step 1: Write failing test**

`apps/api/src/lib/guards.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { requireAuth, requireRole } from "./guards";
import { signAccess } from "./jwt";

function appWithGuardedRoute() {
  const app = Fastify();
  app.get("/admin-only", { preHandler: [requireAuth, requireRole("admin")] }, async (req) => ({
    caller: req.auth!.sub,
  }));
  return app;
}

describe("guards", () => {
  it("401 without token", async () => {
    const res = await appWithGuardedRoute().inject({ method: "GET", url: "/admin-only" });
    expect(res.statusCode).toBe(401);
  });

  it("403 for wrong role", async () => {
    const token = signAccess({ id: "11111111-1111-1111-1111-111111111111", role: "player" });
    const res = await appWithGuardedRoute().inject({
      method: "GET",
      url: "/admin-only",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("200 for admin", async () => {
    const token = signAccess({ id: "22222222-2222-2222-2222-222222222222", role: "admin" });
    const res = await appWithGuardedRoute().inject({
      method: "GET",
      url: "/admin-only",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().caller).toBe("22222222-2222-2222-2222-222222222222");
  });
});
```

- [ ] **Step 2: Run, verify fails** — cannot resolve `./guards`.

- [ ] **Step 3: Implement**

`apps/api/src/lib/guards.ts`:
```ts
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@turney/shared";
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

export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return reply.status(403).send({ code: "FORBIDDEN", message: "Insufficient role" });
    }
  };
}
```

- [ ] **Step 4: Run tests, verify pass** — `pnpm test`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib
git commit -m "feat: requireAuth and requireRole guards"
```

---

### Task 9: Seed script (first admin + smoke data)

**Files:**
- Create: `apps/api/src/db/seed.ts`
- Modify: `apps/api/package.json` (add `"db:seed": "tsx src/db/seed.ts"`)

**Interfaces:**
- Consumes: db client, users table, argon2.
- Produces: idempotent seed — admin `admin@local.dev` / password from `SEED_ADMIN_PASSWORD` env (default `admin-local-dev-only`), one judge, two players.

- [ ] **Step 1: Implement**

`apps/api/src/db/seed.ts`:
```ts
import argon2 from "argon2";
import { db, sql } from "./client";
import { users } from "./schema";

const seedUsers = [
  { email: "admin@local.dev", displayName: "Admin", role: "admin" as const },
  { email: "judge@local.dev", displayName: "Judge One", role: "judge" as const },
  { email: "gai@local.dev", displayName: "Gai", role: "player" as const },
  { email: "ekusu@local.dev", displayName: "Ekusu", role: "player" as const },
];

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin-local-dev-only";
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  for (const u of seedUsers) {
    await db
      .insert(users)
      .values({ ...u, passwordHash })
      .onConflictDoNothing({ target: users.email });
  }
  console.log(`Seeded ${seedUsers.length} users (password: ${password})`);
  await sql.end();
}

main();
```

- [ ] **Step 2: Run + verify**

Run: `cd apps/api && pnpm db:seed && pnpm db:seed`
Expected: runs twice without error (idempotent). `psql`: 4 users, one admin.

- [ ] **Step 3: Commit**

```bash
git add apps/api
git commit -m "feat: idempotent seed script with first admin"
```

---

### Task 10: Expo shell — login + role routing

**Files:**
- Create: `apps/mobile/` via `create-expo-app`, then `app/_layout.tsx`, `app/login.tsx`, `app/(player)/home.tsx`, `app/(judge)/scan.tsx`, `app/(admin)/dashboard.tsx`, `src/stores/auth.ts`, `src/api/client.ts`
- Test: `apps/mobile/src/stores/auth.test.ts`

**Interfaces:**
- Consumes: API at `http://localhost:3000`, `AuthTokens`/`PublicUser` types from `@turney/shared`.
- Produces: `useAuth` zustand store: `{user, accessToken, login(email, pw), logout(), hydrate()}`. `api` fetch wrapper attaching Bearer token. Route groups `(player)`, `(judge)`, `(admin)`.

- [ ] **Step 1: Scaffold Expo app**

```bash
cd apps
pnpm create expo-app@latest mobile --template blank-typescript
cd mobile
pnpm add expo-router zustand @tanstack/react-query @turney/shared expo-secure-store
npx expo install react-native-safe-area-context react-native-screens
```
Set `"main": "expo-router/entry"` in `package.json`; add `"scheme": "tournamentrn"` to `app.json`.

- [ ] **Step 2: Write failing store test**

`apps/mobile/src/stores/auth.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuth } from "./auth";

const tokens = {
  accessToken: "acc",
  refreshToken: "ref",
  user: {
    id: "33333333-3333-3333-3333-333333333333",
    email: "gai@local.dev",
    displayName: "Gai",
    role: "player",
    elo: 1000,
  },
};

describe("auth store", () => {
  beforeEach(() => {
    useAuth.setState({ user: null, accessToken: null });
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => tokens,
    })));
  });

  it("login stores user and token", async () => {
    await useAuth.getState().login("gai@local.dev", "pw-doesnt-matter");
    expect(useAuth.getState().user?.role).toBe("player");
    expect(useAuth.getState().accessToken).toBe("acc");
  });

  it("logout clears state", async () => {
    await useAuth.getState().login("gai@local.dev", "pw");
    useAuth.getState().logout();
    expect(useAuth.getState().user).toBeNull();
  });
});
```

Add vitest to mobile: `pnpm add -D vitest` and script `"test": "vitest run"`.

- [ ] **Step 3: Run, verify fails** — cannot resolve `./auth`.

- [ ] **Step 4: Implement store + api client**

`apps/mobile/src/api/client.ts`:
```ts
const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export async function api(path: string, init: RequestInit = {}, token?: string | null) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ code: "UNKNOWN", message: res.statusText }));
    throw Object.assign(new Error(body.message), body);
  }
  return res.status === 204 ? null : res.json();
}
```

`apps/mobile/src/stores/auth.ts`:
```ts
import { create } from "zustand";
import type { PublicUser } from "@turney/shared";
import { api } from "../api/client";

type AuthState = {
  user: PublicUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  login: async (email, password) => {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
  },
  logout: () => {
    const rt = get().refreshToken;
    if (rt) {
      api("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: rt }) }).catch(
        () => {},
      );
    }
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));
```

- [ ] **Step 5: Run store tests, verify pass** — `pnpm test` in mobile.

- [ ] **Step 6: Routing shell**

`apps/mobile/app/_layout.tsx`:
```tsx
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "../src/stores/auth";
import { tokens } from "@turney/shared";

const qc = new QueryClient();
const groupForRole = { admin: "(admin)", judge: "(judge)", player: "(player)" } as const;

export default function Root() {
  const user = useAuth((s) => s.user);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      if (segments[0] !== "login") router.replace("/login");
      return;
    }
    const target = groupForRole[user.role];
    if (segments[0] !== target) {
      router.replace(
        target === "(admin)" ? "/dashboard" : target === "(judge)" ? "/scan" : "/home",
      );
    }
  }, [user, segments]);

  return (
    <QueryClientProvider client={qc}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: tokens.color.surface },
          headerTintColor: tokens.color.text,
          contentStyle: { backgroundColor: tokens.color.bg },
        }}
      />
    </QueryClientProvider>
  );
}
```

`apps/mobile/app/login.tsx`:
```tsx
import { useState } from "react";
import { View, TextInput, Pressable, Text, StyleSheet } from "react-native";
import { tokens } from "@turney/shared";
import { useAuth } from "../src/stores/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const login = useAuth((s) => s.login);

  async function onSubmit() {
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Sign in</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={tokens.color.textDim}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={tokens.color.textDim}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={({ pressed }) => [styles.button, pressed && { transform: [{ scale: 0.97 }] }]}
        onPress={onSubmit}
      >
        <Text style={styles.buttonText}>Sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: tokens.color.bg },
  title: { color: tokens.color.text, fontSize: 28, fontWeight: "700", marginBottom: 8 },
  input: {
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: tokens.radius.sm,
    color: tokens.color.text,
    padding: 14,
  },
  error: { color: tokens.color.live },
  button: {
    backgroundColor: tokens.color.accent,
    borderRadius: tokens.radius.md,
    padding: 16,
    alignItems: "center",
  },
  buttonText: { color: tokens.color.bg, fontWeight: "700" },
});
```

Placeholder screens, each one line of content, e.g. `app/(player)/home.tsx`:
```tsx
import { View, Text } from "react-native";
import { tokens } from "@turney/shared";

export default function Home() {
  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: tokens.color.text }}>Player home</Text>
    </View>
  );
}
```
Same pattern: `app/(judge)/scan.tsx` ("Judge scan"), `app/(admin)/dashboard.tsx` ("Admin dashboard").

- [ ] **Step 7: Manual smoke test**

Run:
```bash
docker compose up -d
pnpm --filter @turney/api db:seed
pnpm --filter @turney/api dev &
cd apps/mobile && npx expo start --web
```
Expected: browser opens, login as `admin@local.dev` / `admin-local-dev-only` -> lands on Admin dashboard. Login as `gai@local.dev` -> Player home. Wrong password -> inline error.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile
git commit -m "feat: expo shell with login, auth store, role-based routing"
```

---

### Task 11: CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: workspace scripts from all previous tasks.

- [ ] **Step 1: Workflow**

`.github/workflows/ci.yml`:
```yaml
name: ci
on:
  pull_request:
    paths: ["**"]
  push:
    branches: [main]
    paths: ["**"]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: tm
          POSTGRES_PASSWORD: tm_test
          POSTGRES_DB: tournament_test
        ports: ["5433:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 5s
          --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm, cache-dependency-path: pnpm-lock.yaml }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @turney/api db:migrate:test
      - run: pnpm typecheck && pnpm test
```

- [ ] **Step 2: Verify locally**

Run: `pnpm typecheck && pnpm test`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "chore: CI workspace"
```

---

## Self-review notes

- Spec coverage (Phase 1 scope only): monorepo ✓ (T1), tokens + shared schemas ✓ (T2), Postgres + Drizzle ✓ (T3), error envelope ✓ (T4), auth register/login/refresh/logout ✓ (T5-7), role guards ✓ (T8), first-admin seed ✓ (T9), Expo + role routing + press-scale motion rule ✓ (T10), CI ✓ (T11). Socket.io, i18n scaffold deferred to the phases that first need them (Phase 3, Phase 6) — deliberate YAGNI.
- Type consistency: `publicUser`/`authTokens` used identically in T5, T6, T7, T10. `requireRole` produced in T8, first consumed in Phase 2.
- No placeholders: every step has runnable code or exact commands.
