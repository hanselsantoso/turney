# Turney

Beyblade X tournament management platform. Live brackets, ELO rankings, multi-stage Challonge-style formats, deck builder, QR check-in, and community theming.

**Domain:** [turney.id](https://turney.id)

## Stack

- **App:** Expo (React Native) — iOS, Android, web. Expo Router, TanStack Query, zustand
- **API:** Fastify + Drizzle ORM + PostgreSQL 16, socket.io realtime
- **Repo:** Turborepo monorepo, pnpm workspaces

```
apps/api          Fastify + Drizzle + Postgres
apps/mobile       Expo app (iOS/Android/web)
packages/shared   zod schemas, design tokens, pure logic (ELO, brackets, Swiss)
```

## Docs

| Doc | What |
|---|---|
| [docs/specs/design-spec.md](docs/specs/design-spec.md) | Full product + technical spec: schema, API, roles, multi-stage formats, theming |
| [docs/plans/roadmap.md](docs/plans/roadmap.md) | 6-phase build roadmap with dependency graph |
| [docs/plans/phase1-foundation.md](docs/plans/phase1-foundation.md) | Phase 1 TDD implementation plan (monorepo, auth, Expo shell) |
| [docs/plans/prototype-flows.md](docs/plans/prototype-flows.md) | Interactive design prototype plan |
| [docs/design/figma-make-prompts.md](docs/design/figma-make-prompts.md) | Figma Make prompt kit |

## Key product rules

- **Everyone is a player.** Judge/organizer are per-tournament staff grants; staff can play the tournaments they staff (never judging their own matches). Community leaders can play their own events.
- **Multi-stage tournaments:** each stage picks its own bracket format (round robin, Swiss, single/double elim) and scoring (win/loss or points accumulation).
- **Groups are fluid:** organizers move players between groups anytime, audited, with automatic re-pairing.
- **Registration stays open** until explicitly closed; on-spot signup by player code; payment via Midtrans or cash recorded by staff.
- **Runtime theming:** platform accent set by admin, per-community accents set by leaders. Semantic colors fixed.

## Development

Requires Node 20+, pnpm 11, and either Homebrew `postgresql@16` or Docker.

```bash
pnpm install
./scripts/db.sh init          # one-time: project-local Postgres on :5433 (.pgdata/)
pnpm --filter @turney/api db:migrate
pnpm --filter @turney/api db:seed        # admin@turney.id / turney-local-dev
pnpm --filter @turney/api dev            # API on :3001
pnpm --filter @turney/mobile web         # Expo web
pnpm test                                # all suites
```

No Homebrew Postgres? `docker compose up -d` provides the same DBs on :5433/:5434.

Phase 1 (auth + shells) complete. Phase 2 (tournament core) in progress.
