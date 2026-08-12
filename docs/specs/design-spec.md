# Beyblade X Tournament Platform — React Multiplatform + PostgreSQL Remake

Design spec, approved 2026-08-12. Full rewrite of the existing Flutter + Firebase platform.

## Goal

Rebuild the tournament management platform as one Expo (React Native) codebase targeting iOS, Android, and web, backed by a custom Node API on PostgreSQL. Feature parity with the current app plus the analytics Firestore could not do. Local Docker development first; hosting decided later.

## Decisions (locked)

| Area | Choice |
|---|---|
| Client | Expo (React Native) — iOS + Android + web, Expo Router |
| Backend | Fastify + Drizzle ORM + PostgreSQL 16, socket.io realtime |
| Repo | Turborepo monorepo, pnpm workspaces |
| Auth | Self-owned JWT (argon2, access 15min + refresh 30d) |
| Roles | Everyone is a player. Platform admin = flag. Judge/organizer = per-tournament staff grants. Community leader owns a community and may play own events (judged by others) |
| Formats | Multi-stage tournaments (Challonge-style): each stage has own bracket format + scoring system |
| Payments | Midtrans Snap (WebView native / redirect web), webhook idempotent |
| Scope v1 | Everything: tournaments + brackets, payments, ELO + leaderboard, deck builder + parts + QR verification |
| Design | Neon dark theme, Geist/Geist Mono, runtime accent theming (default Volt Purple #a06bff), Emil Kowalski motion system |
| Theming | Accent is a runtime token: admin sets platform default; each community leader sets their community's accent; semantic colors (live/win/loss) fixed |
| Hosting | Local Docker Compose for now; ngrok for Midtrans webhook testing |

## Repo layout

```
tournament-rn/
  apps/api          Fastify + Drizzle + Postgres, socket.io
  apps/mobile       Expo app (iOS/Android/web), Expo Router
  packages/shared   zod schemas, TS types, design tokens, pure logic
                    (ELO, bracket generation, Swiss pairing, group stage)
  docker-compose.yml  Postgres 16 + API
```

Shared zod schemas are the single source of truth: Fastify validates inbound, client infers types. Bracket/ELO logic is pure functions — unit-testable without DB, reusable client-side.

## Database schema

```
users            id, email, password_hash, display_name, is_admin bool,
                 player_code (unique, short human code e.g. GAI-4417),
                 city, region, birth_year, gender (optional, self-described),
                 elo, avatar_url, onboarded_at, created_at
                 -- demographics captured during onboarding; city/region drive
                 -- community discovery. All demographic fields optional but prompted.
communities      id, name, slug, leader_id -> users, accent_color, banner_url,
                 city, region, created_at
community_members  community_id, user_id, joined_at
tournaments      id, community_id -> communities, name, slug,
                 status (draft|reg_open|reg_closed|check_in|in_progress|completed),
                 banner_url, prize_pool jsonb (e.g. [{place:1, prize:"Rp 1.000.000 + PhoenixWing"}]),
                 description, rules,
                 max_participants, entry_fee, reg_type, check_in_enabled,
                 allow_onspot_registration bool (reg stays open until explicitly closed),
                 starts_at, created_by -> users
tournament_stages  id, tournament_id, seq, name,
                 format (round_robin|swiss|single_elim|double_elim),
                 scoring (win_loss|points_accum), points_config jsonb,
                 rounds_planned int, advance_count,
                 status (pending|active|done)
                 -- Challonge-style multi-stage: e.g. stage 1 round robin (points),
                 -- stage 2 double elim, stage 3 single elim final. Any count.
tournament_staff id, tournament_id, user_id, role (organizer|judge),
                 granted_by -> users
                 -- staff can also be registered players in the same tournament;
                 -- a judge never judges their own match (enforced at assignment)
registrations    id, tournament_id, user_id, status (pending|paid|checked_in|cancelled),
                 payment_id, deck_id, seed, qr_token (unique uuid),
                 registered_by -> users nullable (staff on-spot add via player_code),
                 created_at
                 UNIQUE (tournament_id, user_id)
payments         id, registration_id, method (midtrans|cash),
                 midtrans_order_id (unique, nullable), amount,
                 status (pending|settlement|expire|cancel),
                 recorded_by -> users nullable (staff who logged a cash payment),
                 raw_webhook jsonb, paid_at
stadiums         id, tournament_id, name, judge_id -> users   -- shown as "Arena N"
matches          id, stage_id -> tournament_stages, round, bracket_pos,
                 bracket (winners|losers|grand_final), group_id nullable,
                 p1_reg_id, p2_reg_id, winner_reg_id,
                 status (pending|scheduled|in_progress|done), stadium_id
battles          id, match_id, seq, winner_reg_id,
                 finish_type (xtreme|burst|over|spin), points
groups           id, stage_id -> tournament_stages, name, advance_count
group_moves      id, group_id_from, group_id_to, registration_id,
                 moved_by -> users, reason, created_at
                 -- players movable between groups even mid-tournament (walkouts,
                 -- disputes); audit trail required. Bracket engine re-pairs the
                 -- abandoned opponent per the stage's format rules.
elo_history      id, user_id, match_id, elo_before, elo_after, delta, created_at
communities      id, name, slug, leader_id -> users, accent_color (hex, nullable),
                 created_at
platform_settings  key (pk), value jsonb   -- e.g. {"accent_color": "#a06bff"}
parts            id, kind (blade|ratchet|bit|assist_blade), name, alias,
                 attack, defense, stamina, weight, series, image_url
decks            id, user_id, name, created_at
deck_slots       deck_id, slot (1-3), blade_id, ratchet_id, bit_id,
                 assist_blade_id nullable
deck_verifications  id, registration_id, judge_id, status (approved|rejected),
                    notes, verified_at
```

Key decisions:
- `registrations` is the pivot — matches reference registration IDs, not user IDs. Handles admin-added/guest participants.
- `battles` separate from `matches` — Beyblade X per-battle points (Xtreme=3, Burst=2, Over=2, Spin=1); match winner derived from points.
- `qr_token` is an opaque UUID; QR contains token only, API resolves it. No forgeable payloads.
- ELO current value on `users`, append-only `elo_history` for graphs.
- Bracket persisted as `matches` rows with `round`/`bracket_pos` — no jsonb blob; realtime patches single rows.
- Analytics = SQL views + one endpoint. No event-tracking table in v1. Unlocked queries: revenue per tournament, finish-type meta, part win rates (battles → registrations → deck_slots → parts), ELO distribution.

## API surface

Auth: `POST /auth/register|login|refresh|logout`. Argon2 hashing. Role in JWT claims; `requireRole()` middleware. First admin via seed script, not an endpoint.

```
/tournaments                    GET, POST (admin)
/tournaments/:id                GET, PATCH, DELETE (admin)
/tournaments/:id/status         POST  state-machine transitions only
/tournaments/:id/registrations  GET, POST
/tournaments/:id/seeding        POST  ELO-sorted seeding (admin)
/tournaments/:id/bracket        POST generate, GET
/tournaments/:id/groups         GET, POST
/tournaments/:id/advance        POST advance round
/registrations/:id/check-in     POST
/registrations/:id/deck         PUT
/matches/:id                    GET, PATCH
/matches/:id/battles            POST (judge), GET
/matches/:id/finalize           POST (judge) — transaction: points -> winner ->
                                ELO (K=32) -> next-round slot fill -> commit -> emit
/qr/resolve                     POST {token} -> registration + player + deck
/verifications                  POST deck verification (judge)
/payments/create                POST -> Midtrans Snap token
/payments/webhook               POST — signature-verified, idempotent
/payments                       GET (admin)
/parts                          GET catalog, POST/PATCH (admin)
/decks                          CRUD (own)
/players/:id/stats              GET
/leaderboard                    GET
/admin/analytics                GET
```

Tournament status transitions enforced server-side; illegal transitions rejected with 409 + current status.

## Expo app structure

```
app/
  (auth)/login, register
  (player)/  tabs: home, tournaments/[id], decks + builder, profile, leaderboard
  (judge)/   tabs: scan (expo-camera QR), match/[id] (verify -> score -> finalize)
  (admin)/   drawer: dashboard, tournaments (create/detail/seeding/bracket/groups/
             participants), payments, stadiums, parts, analytics
  _layout.tsx  auth gate: JWT role -> route group
src/
  api/        TanStack Query hooks per resource
  socket/     socket.io client -> invalidateQueries on events
  components/ design-system components
  stores/     zustand: auth session only
```

- Server state = TanStack Query only; zustand for auth session only.
- Live bracket: react-native-svg renderer, identical native + web; pinch-zoom, tap for detail sheet.
- QR: expo-camera native; BarcodeDetector web fallback.
- Payments: Snap WebView (native) / redirect (web), poll status on return.
- i18n: i18next, EN + ID from day one (port existing keys).

## Realtime

socket.io, room per tournament (`tournament:{id}`). Events emitted after DB commit only: `match:updated`, `bracket:advanced`, `registration:new`, `payment:settled`, `checkin:update`. Events carry IDs, not payloads — clients refetch through the normal query path. JWT in socket handshake. On reconnect: invalidate all active tournament queries (no event replay).

## Roles model (everyone is a player)

- No global role column. A user is a player everywhere by default. `is_admin` flags platform owners only.
- Judge and organizer are **per-tournament grants** (`tournament_staff`). A community leader assigns members as organizers/judges per tournament; organizers can manage groups, move players, add on-spot registrations, record cash payments.
- Staff can play in the same tournament they staff. Constraint: a judge is never assigned to a stadium/match containing their own registration. Community leaders can play their own events under the same rule.
- Player identity for staff actions: staff add players by `player_code` (short human-readable, printed on profile/QR).

## Onboarding + demographics

First-run flow after account creation, before home: (1) welcome + what the app does, (2) demographics form — city, region, birth year, gender (all optional, skippable, self-described gender), (3) profile personalization — avatar, favorite blade type. `onboarded_at` set on completion; skipped fields re-prompted softly later, never blocking. Demographics power community discovery (same city/region suggestions) and organizer analytics.

## Multi-stage tournaments (Challonge-familiar)

- A tournament = ordered `tournament_stages`. Each stage picks its own format (round robin, Swiss, single elim, double elim) and scoring (win/loss or accumulated points with configurable `points_config`).
- Example: stage 1 round robin in groups (points), top N advance; stage 2 double elim; stage 3 single elim final. Or a one-stage round robin — any combination.
- Groups belong to a stage. Organizers create groups, assign group managers, and can move players between groups at any time, including mid-stage (audited in `group_moves`); the pairing engine resolves the abandoned opponent per format (bye, re-pair, or points forfeit).
- Bracket + standings UI intentionally mirrors Challonge's visual conventions (bracket cells, standings table columns: W-L, game points, tiebreaks) restyled with our tokens, so players migrating from Challonge feel at home.
- Registration: stays open until organizer explicitly closes it — on-spot signups allowed. Staff can register players by player code; payment either Midtrans in-app or cash recorded by staff (`payments.method='cash'`, `recorded_by`).

## Tournament-day dashboards

- **Player tournament dashboard** (after check-in): current stage + round, your arena assignment ("Arena 2"), opponent (name, ELO, seed), match status, full schedule of your upcoming matches, live standings for your group.
- **Judge dashboard**: assigned arena, today's match queue in order, players per match (names, deck verification status), progress through round; tapping a match enters scan → verify → score flow.
- Home page shows a hero banner (featured/live tournament), open tournaments, and community suggestions matched on the user's city/region for users not yet in a community. Home is visible signed-in and signed-out.

## Parts catalog import

Source: beybladebrew.com (community Beyblade X database — stats, images). Site is a JS SPA without a public API; import pipeline uses a headless-browser scrape at build time into `parts` (name, kind, stats, weight, image). Attribution note in app credits; cache images locally; re-run pipeline per new season. Fallback: manual CSV from existing `beyparts.json` + `part_points.json`.

## Theming system

- The accent color is a runtime design token, not a build-time constant. Resolution order per rendered surface: tournament's community accent > platform default (`platform_settings.accent_color`) > built-in Volt Purple `#a06bff`.
- `tournaments.community_id` (nullable FK to `communities`) attaches a tournament to a community; its public pages, bracket broadcast view, and cards render in that community's accent.
- Admin sets the platform accent in a Branding screen. Community leaders (users owning a `communities` row) set `accent_color` for their community.
- All accent-derived tints computed from the single hex (`color-mix` on web, tinted rgba on native). Nothing else in the palette changes.
- Semantic colors are NOT themeable: live/destructive `#ff4655`, win `#2fd47a`, warning `#e2a533`. Neutrals fixed.
- Contrast guard, enforced server-side on save and client-side on preview: text-on-accent flips light/dark by relative luminance; accents failing WCAG AA (3:1 for large UI text) against `#14161b` surfaces are rejected with a suggested nearest passing color.
- API: `GET/PUT /platform/branding` (admin), `communities` CRUD with `PATCH /communities/:id/theme` (leader or admin).

## Design system + motion

Design read: product UI for organizers/players/judges at loud venues; esports-broadcast language; dark-locked theme; mono numerals; restrained purposeful motion. Dials: VARIANCE 5, MOTION 5, DENSITY 6.

Tokens (`packages/shared/design-tokens.ts`):

```ts
color: {
  bg: '#0c0d10', surface: '#14161b', surface2: '#1c1f26',
  border: '#272b33', text: '#f2f3f5', textDim: '#9aa1ad',
  accent: 'runtime token',     // default '#a06bff' Volt Purple; see Theming system
  live: '#ff4655',             // live indicators + destructive only (never themed)
  win: '#2fd47a', loss: '#ff4655', draw: '#9aa1ad',
}
radius: { sm: 8, md: 12, pill: 999 }  // inputs 8, cards 12, status chips pill
type: { sans: 'Geist', mono: 'Geist Mono' }  // mono for ALL numbers
easing: {
  out:   cubic-bezier(0.23, 1, 0.32, 1),
  inOut: cubic-bezier(0.77, 0, 0.175, 1),
  drawer: cubic-bezier(0.32, 0.72, 0, 1),
}
duration: { press: 140, popover: 180, sheet: 260, celebration: 600 }
```

Motion rules (Emil Kowalski framework, Reanimated 3 + Moti):

| Surface | Frequency | Motion |
|---|---|---|
| Judge battle scoring taps | 100+/day | None. Instant state + scale(0.97) press only |
| Tab/nav switches | tens/day | Platform default only |
| Sheets (part picker, match detail) | occasional | Slide 260ms drawer curve, spring drag-dismiss (velocity > 0.11) |
| Bracket first load | occasional | Stagger 40ms/round column, translateY(8)+fade |
| Winner set (live viewers) | occasional | Tint crossfade 200ms + 2px blur mask |
| QR scan success | rare | Checkmark spring {duration 0.5, bounce 0.2} |
| Champion | once/event | Full celebration: trophy spring + confetti |

Hard rules: no scale(0) entries (min 0.95 + opacity); exits faster than enters; transform/opacity only (Reanimated UI thread); reduced-motion degrades to opacity-only; scale press on every pressable; one accent locked; no neon glows. Implementation gate: new animations go through the `animate` skill; motion PRs reviewed with `review-animations`.

## Error handling

- API errors: `{code, message, details?}`, zod-validated. 400 validation, 401/403 auth, 409 state-machine (returns current status), 422 domain rules.
- Client: TanStack Query global onError -> toast (transient) or inline (forms).
- Judge scoring offline queue: visible "pending sync" badge, retry with backoff, server wins on conflict + refetch. Venue WiFi dies, scores never lost.
- Midtrans webhook: signature check (403 on mismatch), idempotent by `midtrans_order_id`, raw payload stored.
- Postgres constraints as last line: unique registration per user per tournament, explicit FK rules, status check constraints.

## Testing

- `packages/shared` pure logic: exhaustive Vitest units; property-based bracket tests (any N participants -> valid bracket, no orphan slots). TDD.
- API: integration with real Postgres (testcontainers); per-endpoint happy + auth-denial + state-machine rejection; full lifecycle E2E (create -> register 8 -> pay -> check-in -> bracket -> score -> champion + ELO verified).
- Mobile: RN Testing Library for scoring screen + deck builder validation. No device-farm E2E in v1.

## Dev environment

- `docker-compose.yml`: Postgres 16 + API. `pnpm dev` = compose up + API watch + Expo start.
- Drizzle migrations; seed script: admin user, parts catalog (port `beyparts.json` / `part_points.json`), demo tournament.
- Midtrans sandbox + ngrok.
- CI: GitHub Actions — typecheck, lint, unit, integration on PR.

## Out of scope (v1)

- Hosting/deployment (decided later; local Docker only)
- Event-tracking analytics table (SQL views suffice)
- Device-farm mobile E2E
- Cloud Functions migration — old Firebase project stays untouched; new system is standalone
