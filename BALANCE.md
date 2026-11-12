# BALANCE.md

Every formula and tunable number in the game. Source of truth for values is
`packages/engine/src/constants.ts` — **change both together**.

Re-check balance after any change:

```bash
npx tsx packages/engine/scripts/balance-report.ts 200 6   # careers, seasons
```

The report simulates careers with a naive "random offered option" player and
prints tier, OVR, apps, goals, rating, promotion/relegation and transfer-offer
rates per season, per position.

---

## 1. Stats & overall rating

- Stats: `pace, shooting, passing, dribbling, defending, physical, mentality`, floats in **[1, 99]**, shown rounded.
- `OVR = Σ weight[position][stat] × stat`

| Pos | pace | shoot | pass | drib | def | phys | ment |
|---|---|---|---|---|---|---|---|
| GK | .05 | 0 | .15 | 0 | .35 | .15 | .30 |
| CB | .10 | 0 | .10 | .05 | .35 | .25 | .15 |
| FB | .25 | 0 | .15 | .10 | .25 | .15 | .10 |
| CM | .05 | .10 | .30 | .15 | .10 | .10 | .20 |
| W  | .30 | .15 | .15 | .30 | 0 | .05 | .05 |
| ST | .20 | .35 | .05 | .15 | 0 | .15 | .10 |

The UI highlights stats with weight ≥ 0.15 as "key" for the position.

## 2. Persona creation

| Name | Value |
|---|---|
| `STAT_TEMPLATES` | per position, tuned to OVR ≈ 40 (see constants) |
| `BONUS_POINTS_TOTAL` | 10 |
| `BONUS_POINTS_PER_STAT_MAX` | 5 |
| `START_AGE` | 17 |
| Hidden potential | `round(triangular(60, 75, 92))` from `hashSeed(seed, 'potential')` |

Potential is never sent to UI components (`personaView` strips it).

## 3. Growth

```
room = clamp((potential − OVR) / GROWTH_ROOM_SPAN, 0, 1)
gain = base × (GROWTH_POS_BASE + GROWTH_POS_FACTOR × weight[pos][stat]) × room
```

Negative deltas (e.g. tactical → pace −0.2) apply directly, without the growth formula.

| Name | Value | Notes |
|---|---|---|
| `GROWTH_ROOM_SPAN` | 15 | growth slows over the last 15 OVR before potential |
| `GROWTH_POS_BASE` | 0.5 | |
| `GROWTH_POS_FACTOR` | 2 | key stats grow ~1.5–1.7× faster than irrelevant ones |
| `TRAINING_GAIN_MULT` | 1.6 | applied to positive training bases |
| `MATCH_XP_BASE` | 0.3 | after each match played … |
| `MATCH_XP_TOP_STATS` | 2 | … to the 2 highest-weighted stats |

## 4. Weekly training

One choice per week out of `TRAINING_OFFER_SIZE = 3`, drawn with `hashSeed(seasonSeed, 'training', week)`.
Rest is **always** offered when `fatigue ≥ 60` or injured. Injured personas gain nothing from non-rest options.

| id | gains (base, before ×1.6 and growth) | fatigue | injury risk (this week's match) |
|---|---|---|---|
| shooting | shooting +1.0 | +15 | 0 |
| gym | physical +1.0 | +10 | +3 pp |
| tactical | mentality +1.0, pace −0.2 | +5 | 0 |
| speed | pace +0.8 | +10 | +2 pp |
| passing | passing +0.8, dribbling +0.2 | +5 | 0 |
| dribbling | dribbling +1.0 | +10 | 0 |
| defending | defending +1.0, mentality +0.2 | +10 | 0 |
| rest | — | −30 | 0 |

## 5. Fatigue & injury

Weekly order: training → match → match fatigue → recovery → new injury.

| Name | Value | Formula |
|---|---|---|
| `FATIGUE_PER_FULL_MATCH` | 25 | `+25 × minutes / 90` |
| `FATIGUE_WEEKLY_RECOVERY` | 35 | |
| `FATIGUE_STAT_PENALTY` | 0.25 | `effective = stat × (1 − 0.25 × fatigue/100)` in matches |
| `FATIGUE_SUB_THRESHOLD` / `_MINUTE` | 70 / 65' | starter with fatigue > 70 is subbed off at 65' |
| `INJURY_BASE` | 0.02 | `p = 0.02 + 0.05 × fatigue/100 + trainingRisk` per match played |
| `INJURY_FATIGUE_FACTOR` | 0.05 | |
| `INJURY_WEEKS_MIN/MAX` | 1 / 3 | |

## 6. Selection

```
P(start) = clamp(0.5 + (OVR − clubAvg + SELECTION_OFFSET) × SELECTION_SLOPE, 0.05, 0.98)
if not starting: P(sub appearance) = SUB_APPEARANCE_CHANCE
```

| Name | Value |
|---|---|
| `SELECTION_OFFSET` | 4 |
| `SELECTION_SLOPE` | 0.06 |
| `SUB_APPEARANCE_CHANCE` | 0.3 (comes on between 60' and 75') |

`clubAvg` = mean of club `att, mid, def, gk`.

## 7. Match simulation (deterministic per seed)

Match seed = `hashSeed(seasonSeed, 'match', matchId)`. RNG = mulberry32.

- `PHASES_PER_MATCH = 22` attack phases at sorted random minutes 1–90.
- Attacking side: `P(home) = (mid_h + HOME_ADVANTAGE) / (mid_h + HOME_ADVANTAGE + mid_a)`, `HOME_ADVANTAGE = 3`.
- While the persona is on the pitch, their team's 4 ratings shift by `(personaOVR_eff − teamAvg) × PERSONA_TEAM_INFLUENCE` (**0.1**).
- Each phase: pass → dribble duel → shot. `p = clamp(base + (A − D) × slope, lo, hi)`:

| Step | A | D | base | slope | lo | hi |
|---|---|---|---|---|---|---|
| pass | att `mid` (or persona passing) | def `mid` | 0.70 | 0.015 | 0.35 | 0.92 |
| dribble | att `att` (or persona 0.6·drib + 0.4·pace) | def `def` (or persona 0.7·def + 0.3·phys) | 0.55 | 0.015 | 0.25 | 0.85 |
| goal | att `att` (or persona shooting) | def `gk` (or GK persona 0.5·def + 0.3·ment + 0.2·phys) | 0.32 | 0.012 | 0.08 | 0.60 |

Equal teams → ≈ 0.12 goals/phase → **≈ 2.6–3.0 goals/match** (tested: 2–3.5).

Missed shots: `SAVE_SHARE = 0.5` are saves, the rest go wide.

**Persona involvement** (one roll per attacking phase, exclusive):

| Pos | pass | dribble | shot | defends duel (opp. phase) |
|---|---|---|---|---|
| GK | 0 | 0 | 0 | faces every shot |
| CB | .08 | 0 | .03 | .30 |
| FB | .10 | .15 | .02 | .20 |
| CM | .35 | .08 | .08 | .10 |
| W  | .10 | .35 | .20 | .03 |
| ST | .05 | .10 | .45 | 0 |

**Cards:** `CARD_PER_PHASE = 0.04` (defending side). Persona's share `= 0.12 × (1.5 − mentality/100)`; second yellow or `RED_STRAIGHT_SHARE = 0.08` → red (persona leaves).
**Subs:** `TEAM_SUBS = 2` per side at 55'–85' (persona subs count towards their side).

## 8. Match rating (persona)

```
6.0 + 1.2·goals + 0.8·assists + 0.3·keyChances + 0.2·(duelsWon − duelsLost)
    − 0.5·yellow − 1.5·red + 0.3 (win) / −0.3 (loss) + cleanSheet[pos]
GK only: + 0.4·saves − 0.4·conceded
clamped to [3, 10], 1 decimal
```

`RATING_CLEAN_SHEET`: GK 0.8, CB 0.5, FB 0.4, CM 0.2, W 0, ST 0.
`keyChances` = persona shot that missed, or persona pass that led to a missed shot.

## 9. League & seasons

| Name | Value |
|---|---|
| Tiers | 1 Oltin Liga · 2 Kumush Liga · 3 Bronza Liga · 4 Akademiya Ligasi (all fictional) |
| `CLUBS_PER_TIER` | 8 → double round-robin, **14 matches/season** |
| `TIER_BASE_RATING` | 75 / 65 / 55 / 45 |
| `CLUB_RATING_SPREAD` | ±5 per club, ±2 per component |
| Points | win 3, draw 1. Sort: pts, GD, GF, name |
| `PROMOTION_SPOTS` / `RELEGATION_SPOTS` | 2 / 2 |
| `TIER_DRIFT` | 0.4 — after moving tier, ratings move 40 % toward the new tier base |
| `UNSIMULATED_TIER_NOISE` | ±6 — tiers not played by the persona are ranked by rating + noise |

The persona starts in a random tier-4 (academy) club and moves with it.

## 10. Transfers (the second choice)

Offered at season end when **all** hold:
- club's new tier > 1, persona played ≥ 5 matches,
- season avg rating ≥ `TRANSFER_MIN_AVG_RATING[pos]` = GK 6.6, CB 6.3, FB 6.2, CM 6.8, W 6.8, ST 7.0,
- `OVR ≥ TIER_BASE_RATING[newTier − 1] − TRANSFER_OVR_MARGIN (5)`.

`TRANSFER_OFFERS = 2` random clubs one tier above.

## 11. Current balance snapshot (random policy, 200 careers × 6 seasons)

| Pos | S1 OVR → S6 OVR | Avg tier S6 | Goals/season (S1 → S6) | Offer rate S3–S6 |
|---|---|---|---|---|
| GK | 44.8 → 66.8 | 2.6 | 0 | 16–32 % |
| CB | 44.3 → 64.8 | 2.6 | 0.1–0.2 | 30–46 % |
| FB | 42.8 → 59.9 | 3.1 | 0.1 | 19–39 % |
| CM | 43.2 → 61.0 | 3.1 | 0.5–0.9 | 19–38 % |
| W  | 44.9 → 64.9 | 2.9 | 2.0–2.8 | 21–38 % |
| ST | 44.6 → 63.7 | 2.5 | 5.4–10 | 18–52 % |

## Open balance risks

1. **FB and CM climb slowest.** Their OVR grows slowest (many medium-weight stats) and their ratings run lower.
2. **The top tier is rarely reached in 6 seasons** with a random policy. That is probably right for an aspirational arc, but it needs player testing.
3. **Strikers' goal tallies grow fast in later seasons** (~10 a season), while their ratings stay in the 7s.
4. **No ageing decline yet.** Growth only stops at potential. Decline after 30 is a planned addition.
5. **Unsimulated tiers** use rating + noise rather than a played season. That is cheap but makes their movement feel random.
