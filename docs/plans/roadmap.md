# Remake Roadmap — React Multiplatform + PostgreSQL

> Master roadmap. Each phase has (or will get) its own detailed plan in this directory.
> Spec: `docs/superpowers/specs/2026-08-12-react-postgres-remake-design.md`

**Goal:** Rebuild the Beyblade X tournament platform as Expo (iOS/Android/web) + Fastify + Drizzle + PostgreSQL, full feature parity plus relational analytics.

## Phase dependency graph

```mermaid
flowchart TD
    P1["Phase 1: Foundation\nmonorepo, Docker Postgres,\nshared package, auth JWT,\nExpo shell + role routing"]
    P2["Phase 2: Tournament Core\ntournaments CRUD, state machine,\nregistrations, check-in, stadiums"]
    P3["Phase 3: Bracket Engine\nsingle/double elim, Swiss, groups,\njudge scoring, ELO, realtime"]
    P4["Phase 4: Decks & QR\nparts catalog, deck builder,\ndeck registration, QR verify"]
    P5["Phase 5: Payments\nMidtrans Snap, webhook,\npayment monitor"]
    P6["Phase 6: Analytics & Polish\nleaderboard, player stats,\nadmin analytics, i18n, motion pass"]

    P1 --> P2
    P2 --> P3
    P2 --> P4
    P2 --> P5
    P3 --> P6
    P4 --> P6
    P5 --> P6
```

Phases 3, 4, 5 are independent of each other after Phase 2 — build in any order or parallel worktrees.

## Tournament lifecycle state machine

```mermaid
stateDiagram-v2
    [*] --> draft: admin creates
    draft --> reg_open: open registration
    reg_open --> reg_closed: close registration
    reg_closed --> check_in: enable check-in
    reg_closed --> in_progress: start (no check-in)
    check_in --> in_progress: start tournament
    in_progress --> completed: champion decided
    draft --> [*]: delete
```

All transitions via `POST /tournaments/:id/status`. Anything else = 409 + current status.

## Match finalize sequence (the critical transaction)

```mermaid
sequenceDiagram
    participant J as Judge app
    participant A as API
    participant DB as Postgres
    participant S as socket.io room
    participant V as Viewers

    J->>A: POST /matches/:id/finalize
    A->>DB: BEGIN
    A->>DB: tally battle points -> winner
    A->>DB: insert elo_history, update users.elo (K=32)
    A->>DB: fill winner into next-round match (bracket_pos math)
    A->>DB: COMMIT
    A->>S: emit match:updated + bracket:advanced (IDs only)
    S->>V: events
    V->>A: refetch bracket (TanStack Query invalidate)
    A-->>J: 200 (optimistic UI already showed winner)
```

## Entity relationships (core)

```mermaid
erDiagram
    users ||--o{ registrations : has
    tournaments ||--o{ registrations : contains
    registrations ||--o| payments : "paid by"
    registrations ||--o| decks : uses
    tournaments ||--o{ matches : contains
    tournaments ||--o{ stadiums : has
    tournaments ||--o{ groups : has
    matches ||--o{ battles : "scored by"
    matches }o--|| registrations : p1_p2_winner
    users ||--o{ elo_history : tracks
    users ||--o{ decks : owns
    decks ||--|{ deck_slots : "3 slots"
    deck_slots }o--|| parts : references
    registrations ||--o{ deck_verifications : verified
```

## Phase plans

| Phase | Plan file | Status |
|---|---|---|
| 1 Foundation | `2026-08-12-phase1-foundation.md` | written |
| 2 Tournament Core | written when Phase 1 done | pending |
| 3 Bracket Engine | written when Phase 2 done | pending |
| 4 Decks & QR | written when Phase 2 done | pending |
| 5 Payments | written when Phase 2 done | pending |
| 6 Analytics & Polish | written when 3-5 done | pending |

Each later plan is written against the real code of its predecessors — no stale-plan drift.

## Definition of done per phase

- Phase 1: `pnpm dev` boots Postgres + API + Expo; register/login works on web + native; role routing sends admin/judge/player to their route groups; CI green.
- Phase 2: admin creates tournament, walks the full status state machine; players register; check-in works; 409s on illegal transitions proven by tests.
- Phase 3: 8-player single-elim E2E test passes: bracket generated, judge scores battles, finalize advances rounds, champion + correct ELO. Double elim, Swiss, groups property-tested. Live bracket updates via socket.
- Phase 4: player builds deck from parts catalog, attaches to registration, judge scans QR, resolves registration, approves deck.
- Phase 5: sandbox Midtrans payment settles a registration via webhook; idempotency proven; payment monitor lists live.
- Phase 6: leaderboard, player stats graphs, admin analytics endpoint, EN/ID i18n complete, motion pass through `animate`/`review-animations` skills.
