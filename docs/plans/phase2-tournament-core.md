# Phase 2: Tournament Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Executed inline (autonomous session, user-authorized).

**Goal:** Admin/community leaders create multi-stage tournaments and walk the full status state machine; players register (self or staff on-spot); check-in works; staff grants enforced. All server-verified by integration tests.

**Architecture:** Extends Phase 1. New Drizzle tables per spec (communities, community_members, tournaments, tournament_stages, tournament_staff, registrations, payments, stadiums, groups, group_moves). Pure state machine logic in @turney/shared. Fastify route modules per resource guarded by requireAuth + capability checks (isAdmin | community leader | tournament staff).

**Tech Stack:** unchanged from Phase 1.

## Global Constraints

- Everyone is a player: no role column; capabilities derive from is_admin, communities.leader_id, tournament_staff rows.
- Tournament status transitions ONLY via POST /tournaments/:id/status; illegal transition = 409 + current status.
- Valid transitions: draft→reg_open→reg_closed→(check_in|in_progress), check_in→in_progress, in_progress→completed, draft→deleted.
- Multi-stage: tournaments carry ordered stages (format, scoring, config). Stage engine (pairing) is Phase 3; Phase 2 persists definitions.
- Registrations unique per (tournament, user). qr_token = UUID. On-spot add by player_code while status=reg_open, by staff/leader/admin only.
- Payments Phase 2 = cash only (method=cash, recorded_by); Midtrans lands Phase 5 on the same table.
- Every request body zod-validated from @turney/shared.

## Task list

1. Shared: tournament schemas + state machine (`canTransition(from,to)`) — unit tested
2. DB: full Phase 2 schema + migration (all tables above)
3. Communities CRUD + membership (create=any user becomes leader; join/leave; region/city list endpoint) — integration tests
4. Tournaments: create (with stages array, banner, prize_pool) under a community by leader/admin; GET list/detail incl. stages; PATCH draft-only fields
5. Status endpoint with state machine + 409 contract tests
6. Staff: grant/revoke organizer|judge (leader/admin); capability helper `canManage(tournamentId, userId)`
7. Registrations: self-register (reg_open, capacity check), staff on-spot by player_code, cash payment record, check-in (self via qr_token or staff), cancel
8. Stadiums CRUD + judge assignment (never own match constraint deferred to Phase 3 match assignment)
9. Groups: create per stage, assign manager, move player with group_moves audit row
10. E2E flow test: leader creates community → tournament (3 stages) → open reg → 8 players register (1 on-spot cash) → close → check-in → start → complete

Each task: failing test first, implementation, green, commit.
