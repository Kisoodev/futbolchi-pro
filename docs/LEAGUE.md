# FUTPRO.UZ — Akademiya ligasi

Every career starts at **Etiqod Akademiyasi** (*Etiqod Football Academy*). "E'tiqod" means belief, faith: the hero left everything behind on belief alone. Motto: *"Ishonch — birinchi qadam."* (Belief is the first step.)

The academy league is always the same 16 clubs: a double round-robin gives 30 matches, the season length that `PROGRESSION_SYSTEM.md` is balanced for. Strength fits the academy range (55–62; no academy player is above 62 at the start — only Odil may grow past it). The leagues above (2-liga, 1-liga) are still generated from invented town names.

Source of truth in code: `packages/engine/src/academyLeague.ts` (`ACADEMY_CLUBS`).

| # | Club | Nods to | Colours | Kit | Avg OVR | Style (`ClubStyle`) |
|---|---|---|---|---|---|---|
| 1 | **Etiqod Akademiyasi** ⭐ | Etihad (Man City) | Sky blue `#6CABDD` + white | Sky-blue shirt, white shorts | 57 | `disciplined` — the hero's club. Mid-table, poor, but organised |
| 2 | **Masiya Akademiyasi** | La Masia | Pomegranate `#9B1B4A` + navy `#1E3A8A` | Vertical stripes | 59 | `possession` — short passes, keeps the ball |
| 3 | **Valdebella** | Valdebebas | White `#F5F5F5` + gold `#C9A227` | White, gold trim | 60 | `stars` — rich academy of stars, proud |
| 4 | **De Tokomsta** | De Toekomst | White + red `#D2122E` | Wide red chest band | 60 | `technical` — a factory of young talent |
| 5 | **Kirkvale** | Kirkby | Red `#C8102E` | All red | 59 | `press` — high press, fast attacks |
| 6 | **Cobhill** | Cobham | Royal blue `#1B4FA0` | All blue | 59 | `physical` — strong, organised defence |
| 7 | **Kraftberg Akademie** | German academies | Orange `#F26B1D` + navy `#14213D` | Orange, navy shoulders | 59 | `intense` — fierce, very fast |
| 8 | **Clairmont** | Clairefontaine | Navy `#0B1F4B` + silver `#B8C2CC` | Navy, silver trim | 61.5 | `athletic` — **the strongest academy**: athletic, quick players |
| 9 | **Lezana** | Lezama | Red `#B71C1C` + black | Red shirt, black shorts | 58 | `stubborn` — never gives up |
| 10 | **Alcova** | Alcochete | Emerald `#00875A` + black | Horizontal hoops | 58 | `wings` — dangerous wingers |
| 11 | **Hale Ridge** | Hale End | Purple `#5B2A86` + white | Purple, white sleeves | 58 | `combination` — combination play |
| 12 | **Aspira Akademiyasi** | Aspire | Maroon `#7A1F3D` | All maroon | 57 | `modern` — science-based |
| 13 | **Paxtazor** | Paxtakor | Green `#1E8E3E` + white | Green, white collar | 57 | `traditional` — local pride |
| 14 | **Bunyodlar** | Bunyodkor | Yellow `#FFC72C` + blue `#0057B8` | Yellow shirt, blue shorts | 56 | `chaotic` — young, unpredictable |
| 15 | **Brightdream Academy** | Right to Dream | Yellow `#FFD400` + black | Yellow-black halves | 55 | `raw` — fast, physical, raw technique |
| 16 | **Turon Akademiyasi** | Local, Samarkand domes | Turquoise `#1FB5AD` + white | Turquoise, white trim | 55 | `underdog` — small, never beaten in spirit |

**Strength groups:** favourite (61.5) Clairmont · strong (60) Valdebella, De Tokomsta · upper mid (59) Masiya, Kirkvale, Cobhill, Kraftberg · mid (57–58) — Etiqod starts here · bottom (55–56) Bunyodlar, Brightdream, Turon.

## Rules

- **Fictional only.** The names nod to real academies but none is a real club. No real crests or logos: every club gets its own drawn crest (`apps/web/src/components/Crest.tsx`: shape from the club id, colours and pattern from its kit, letters from its name).
- **Kits.** Each club has a home kit (`Kit`: shirt, secondary, shorts, socks, pattern). When the shirts of two teams are too close (Kirkvale and Lezana are both red), the away side wears a white or dark change kit trimmed in its own colour (`matchKits` in `apps/web/src/replay/kits.ts`).
- **Style.** A club's style leans the match engine's choices (`MATCH_CONFIG.styles`: small multipliers on actions and on how often its defenders go in for the tackle), so a possession side passes more and a pressing side wins the ball higher — strength still decides results.
- **Later:** from part 3 of the videos the hero's shirt can show "ETIQOD".

## The title race

The goal of the academy years: **win the league and pass Odil** — possible, but it takes work.

- Clairmont is the favourite. Etiqod starts mid-table (57).
- **The team grows with training** (`packages/engine/src/teamGrowth.ts`): every week each teammate may gain +1 OVR — 3% a week, 13% in a week the persona really trained (anything but rest). Teammates stay inside the academy range (62 at most).
- **The persona grows faster** than the teammates (XP from training and matches, PROGRESSION_SYSTEM.md), and their own attributes play in every match.
- **Odil grows too** (10% a week, up to 66), so passing him is a race, not a formality.

Measured with `npx tsx packages/engine/scripts/season-sim.ts 40 W smart` / `... lazy` (first season, winger):

| Player | Champion: Etiqod | Champion: Clairmont | Etiqod average finish | Persona OVR | Odil OVR | Ahead of Odil at season end |
|---|---|---|---|---|---|---|
| Trains every week (sensible choices) | 28% | 28% | 3.9th | 52 → 63.7 | 62 → 64.4 | 30% (around week 29) |
| Rests whenever possible | 10% | 30% | 5.3rd | 52 → 60.5 | 62 → 64.2 | 0% |

A champion goes up to the 2-liga; otherwise the team (grown) tries again next season, when passing Odil becomes likely.
