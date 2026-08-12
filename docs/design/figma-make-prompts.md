# Figma Make Prompt Kit — Beyblade X Tournament Platform

How to use:
1. Open Figma Make, new project.
2. Paste **PROMPT 0 (Master)** first — it sets the whole design system. Let it generate the base.
3. Then paste screen prompts (1-8) one at a time, iterate each until happy.
4. If Make drifts off-style, paste the **STYLE GUARD** block again.
5. Download code: Make project menu -> export/download code. Put the export in `design-reference/figma-make/` in this repo. Claude translates it to React Native using the shared tokens.

---

## PROMPT 0 — MASTER (paste first)

```
You are designing "SEKOCI Arena", a Beyblade X tournament management platform. Three user roles: players (register, build 3-Beyblade decks, follow live brackets), judges (scan player QR codes at the venue, verify decks, score battles), admins (create tournaments, manage brackets, monitor payments).

DESIGN DIRECTION: esports-broadcast clean. Think start.gg or a tournament stream overlay: dark, sharp, information-dense but calm. NOT cyberpunk, NOT neon glow, NOT gamer-RGB. Professional broadcast graphics energy. Must be readable on a phone at a loud, bright venue.

STRICT DESIGN TOKENS (never deviate):
- Background: #0c0d10 (page), #14161b (cards/surfaces), #1c1f26 (elevated surfaces, inputs)
- Border/dividers: #272b33, 1px
- Text: #f2f3f5 primary, #9aa1ad secondary
- Accent: #3d8bff (electric blue). This is the ONLY accent color. Buttons, active states, links, focus rings, selected tabs: all #3d8bff. Never introduce purple, teal, or gradients as accents.
- #ff4655 red: RESERVED for live-match indicators and destructive actions only.
- #2fd47a green: win states only. #ff4655 also doubles as loss states.
- Dark theme ONLY. No light mode. Never place pure black #000 or pure white #fff anywhere.

TYPOGRAPHY:
- Font: Geist (fall back to Inter if Geist unavailable in Make).
- ALL numbers are monospace (Geist Mono / JetBrains Mono): ELO ratings, scores, seeds, timers, prices, counts. This is the signature look: broadcast scoreboard numerals.
- Headlines: tight tracking, semibold. Body: regular, relaxed. No serif anywhere. No italic decoration.

SHAPE SYSTEM (locked):
- Inputs and small controls: 8px radius
- Cards and sheets: 12px radius
- Status chips/badges/pills: fully rounded
- Never mix other radii.

COMPONENT RULES:
- Buttons: solid #3d8bff with #0c0d10 text (primary), #1c1f26 with #f2f3f5 text and 1px #272b33 border (secondary). Press state scales to 0.97.
- Status chips: pill, tinted background at 15% opacity of their semantic color, solid color text. E.g. live = #ff4655 at 15% bg + #ff4655 text + small solid dot.
- Cards: #14161b, 1px #272b33 border, 12px radius, NO drop shadows (flat dark UI, borders do the separation).
- Forms: label ABOVE input, never placeholder-as-label. Error text below input in #ff4655.
- Empty states: composed, with one-line instruction how to fill them. No sad-face illustrations.
- Loading: skeleton blocks matching final layout, no spinners.

BANNED (hard rules): purple/violet anywhere, gradient backgrounds, gradient text, neon glow effects, outer glows, glassmorphism, emoji in UI, decorative dots on nav items, em-dashes in copy, more than one accent color, drop shadows on dark surfaces, generic "John Doe" placeholder names.

PLACEHOLDER CONTENT: use Beyblade X flavored data. Player names: Gai, Ekusu, Multi, Bird, Kurenai Jack. Beyblade parts: DranSword 3-60F, HellsScythe 4-60T, WizardArrow 4-80B, KnightShield 3-80N. Tournament names: "Jakarta X Open", "SEKOCI Weekly #12", "West Java Regional". Currency: Indonesian Rupiah (Rp 50.000 format). ELO values like 1247, 1082, 1391 (never round numbers).

Motion (for prototype interactions): fast and restrained. Transitions 140-260ms, ease-out. Sheets slide up. Nothing bounces except one celebration moment (champion screen). No looping ambient animations.

Start by generating: the design system sheet (colors, type scale, buttons, chips, inputs, card) as the first artifact.
```

---

## STYLE GUARD (re-paste when Make drifts)

```
Style check, re-apply strictly: dark #0c0d10 base only, single accent #3d8bff, red #ff4655 only for live/destructive, all numbers monospace, radii 8/12/pill only, no gradients, no glow, no purple, no shadows, no emoji. Fix any element violating these before continuing.
```

---

## PROMPT 1 — Login + Register

```
Design the auth screens (mobile-first 390px, also show desktop web variant).

LOGIN: app wordmark "SEKOCI ARENA" top-left area, "Sign in" heading, email + password fields (labels above), primary button "Sign in", subtle link "Create account". One inline error state variant: wrong password, error text under password field.

REGISTER: email, password, display name. Note under display name: "Shown on brackets and leaderboards". Button "Create account".

Keep it sparse: no hero art, no illustration. The dark surface + type IS the design. Show both empty and filled states.
```

## PROMPT 2 — Player home + tournament browse

```
Design player home (mobile 390px): greeting row with display name + ELO chip (mono numerals, e.g. "ELO 1247"), section "Your next match" as a match card (two player names, VS, round label "Winners R2", stadium "Stadium 3", status chip "scheduled"), section "Active registrations" (tournament cards), section "Open tournaments" list.

Tournament card: name, date, format chip ("Double Elim"), entry fee "Rp 50.000" mono, capacity "24/32" mono, one status chip (reg open = accent blue tint / in progress = red LIVE chip).

Bottom tab bar: Home, Tournaments, Decks, Profile. Active tab accent blue. Also show tournament detail screen: header with name + status, info rows (date, format, fee, participants), primary CTA "Register" and its paid state "Registered ✓ Show QR" (green tint chip), then "View bracket" secondary button.
```

## PROMPT 3 — Live bracket

```
Design the live bracket screen (mobile 390px horizontal-scroll + desktop 1280px full view). Double elimination bracket, 8 players: winners bracket top, losers below, grand final right.

Match cells: compact card, two rows (player name + mono score each), winner row highlighted with #2fd47a left edge bar, loser dimmed. Live match cell: #ff4655 border + small pulsing LIVE chip. Pending match: dashed border, "TBD" dim.

Round column headers: "WINNERS R1", "WINNERS FINAL", "LOSERS R1"... small caps, dim. Connector lines #272b33.

Top bar: tournament name, round progress "Round 3 of 6" mono, filter chips (All / Winners / Losers). Tapping a match opens a bottom sheet: full match detail, battle-by-battle score list (finish type labels: XTREME +3, BURST +2, OVER +2, SPIN +1, each mono), judge name, stadium.
```

## PROMPT 4 — Judge: QR scan + deck verify + battle scoring

```
Design the judge flow, 3 screens (mobile 390px, this is used one-handed at a venue table):

1. SCAN: full-bleed camera viewfinder, corner brackets marking scan zone, instruction "Scan player QR", after-scan success state: player card slides up (name, seed #4 mono, tournament, deck name) with big green check and buttons "Verify deck" / "Wrong player".

2. DECK VERIFY: deck "Storm Trio" with 3 Beyblade slots, each slot a row: blade + ratchet + bit names (e.g. "DranSword 3-60F"), photo thumbnail placeholder, approve/reject toggle per slot, notes field, big primary "Approve deck" + destructive-secondary "Reject".

3. BATTLE SCORING: the most important screen. Two player columns (names + running score huge mono numerals), between them round indicator "Battle 3". Four giant scoring buttons full-width stacked: "XTREME FINISH +3", "BURST FINISH +2", "OVER FINISH +2", "SPIN FINISH +1" — tap assigns to the currently selected player (player column tap-to-select, selected has accent border). History list below (undo-able rows). Sticky bottom: "Finalize winner" primary button, disabled until threshold. NO animations on scoring buttons, instant feedback, they get tapped hundreds of times.
```

## PROMPT 5 — Deck builder

```
Design deck builder (mobile 390px): deck name field top, 3 numbered Beyblade slots as cards. Each slot: 4 part rows (Blade, Ratchet, Bit, optional Assist Blade), empty part row shows "+ Select blade" dim, filled shows part name + tiny stat bars (Attack/Defense/Stamina as 3 thin bars, accent fill).

Part picker bottom sheet: search field, filter chips by series, part list rows with name + stat bars + weight "38.2g" mono. Selected part row: accent border.

Validation states: duplicate part across slots = red border + error text "DranSword already used in Slot 1". Complete deck = summary footer with total weight mono + "Save deck" primary.
```

## PROMPT 6 — Admin dashboard + tournament create

```
Design admin screens (desktop 1280px web, sidebar nav left: Dashboard, Tournaments, Payments, Stadiums, Parts, Analytics — icons + labels, active accent).

DASHBOARD: 6 stat tiles in grid (Total tournaments 14, Active 2, Players 312, Pending payments 7, Live matches 3, Stadiums 8 — all numerals mono, tile = card with dim label + huge number). Below: "Live now" section listing in-progress matches with red LIVE chips, and recent registrations feed.

TOURNAMENT CREATE: single-column form, max 640px wide, grouped in sections with dividers (Basics / Format / Registration / Check-in / Tiebreakers): name, date-time picker, format select (Single Elim / Double Elim / Swiss / Group Stage as segmented control), max participants stepper mono, entry fee input "Rp" prefix, registration type toggle, check-in toggle, tiebreaker method reorderable list. Sticky footer: "Create tournament" primary + "Save draft" secondary.
```

## PROMPT 7 — Payments monitor + analytics

```
Design admin payments + analytics (desktop 1280px):

PAYMENTS: filterable table (status chips: pending amber tint, settlement green, expire dim, cancel red), columns: order ID mono, player, tournament, amount "Rp 50.000" mono, status, time. Row click opens side panel with raw webhook detail. Top: filter chips + search.

ANALYTICS: stat row (revenue this month "Rp 4.250.000" mono huge), then 2-column chart grid: "Finish type meta" horizontal bar chart (Xtreme 41%, Burst 28%, Over 19%, Spin 12% — accent bars on dark), "Part win rates" ranked list (part name + win% mono + thin bar), "ELO distribution" histogram, "Registrations over time" line chart. All charts: single accent color + dims, no rainbow palettes, gridlines #272b33.
```

## PROMPT 8 — Leaderboard + player profile

```
Design leaderboard + profile (mobile 390px):

LEADERBOARD: top 3 as podium cards (rank medal-free: just big mono rank numbers 1 2 3, name, ELO), then ranked list rows: rank mono, name, ELO mono, tiny trend arrow (+12 green / -8 red mono). Filter: All time / This season.

PROFILE: header (avatar circle, display name, ELO huge mono with small history sparkline), stat grid (Matches 47, Wins 31, Win rate 66%, Best finish "1st — Jakarta X Open" — mono numbers), ELO history line chart (accent line on dark), match history list (opponent, result W/L chip, ELO delta mono, tournament, date).
```

---

## After download

1. Unzip Make export into `design-reference/figma-make/` (git-ignore heavy assets if huge).
2. Tell Claude "figma make code is in design-reference/figma-make". Claude then:
   - extracts real spacing/sizing values from the Tailwind classes,
   - reconciles them against `packages/shared` tokens (tokens win on conflict),
   - translates screen-by-screen to React Native components during Phases 2-6.
3. Make's React web code is a visual reference, NOT copied directly — it becomes RN StyleSheet + Reanimated per the motion spec.
