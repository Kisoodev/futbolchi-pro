# Match engine — assumptions

Decisions taken where docs/MATCH_ENGINE.md leaves room (§0.2). One line each: situation → decision → why. Every number lives in `MATCH_CONFIG` (packages/engine/src/sim/config.ts).

## Model and time
- Ticks → `TICKS_PER_MATCH` = 180 is a time budget (30 s a tick); a quick unpressured short/back pass costs 0.35 tick, other passes 0.6, everything else 1 → about 80 passes a team; real build-up has many more touches than one action every 30 s.
- Half-time → at tick 90 the second half starts with the away kick-off; after a goal the team that conceded kicks off.
- Possession → measured as time on the ball (ticks used while a side had it), not as number of decisions; a team that shoots a lot would otherwise look like it had less of the ball.
- Engine use → the new engine plays every match where both lineups are known (all league fixtures); the old phase engine stays only for calls without lineups and for old saved matches.
- Replay → the action log is not stored: the match keeps its seed, lineups and the persona's input, and the replay regenerates the same log (determinism, §12).

## Attributes
- Mapping → pace/shooting/passing/dribbling/defending/physical = PAC/SHO/PAS/DRI/DEF/PHY; VIS, COM, STA, HEA computed with the §3 formulas.
- NPC attributes → NPCs only have an OVR: a position profile (striker SHO +7 DEF −18, centre-back DEF +7 SHO −14 …) plus ±3 personal noise, shifted so the weighted OVR equals the NPC's OVR.
- Characters → Odil PAC/DRI +6, DEF −8 (fast and tricky, lazy without the ball); Abu GK_REF +5, GK_HAN −6, PHY −6 (great reflexes, weak hands); other characters from docs/CHARACTERS.md the same way.
- Goalkeepers → GK_REF = OVR+3, GK_HAN = OVR, GK_POS = OVR+1, GK_KIC = OVR−6 for NPCs; a goalkeeper persona's keeping skills come from defending/physical/passing; outfielders have 25.
- Out of position → −`OUT_OF_POSITION_PENALTY` on all outfield attributes when the slot's position differs from the player's.
- Morale → 1.0 for everyone, home side ×1.01 (small home advantage).
- Pre-match tiredness → the persona's fatigue lowers their stats before kick-off (existing `effectiveStats`); in-match fatigue uses the §8 formula counted from when a player came on, so substitutes are fresh.

## Strength and level
- Compression → in a duel, attributes are pulled towards the match level (×0.3, passing ×0.7) and big gaps saturate (d → 12·tanh(d/12)). Without it a 5-OVR gap compounds over ~200 duels and the stronger team won 70%+, a 15-OVR gap 99% (§9 asks 55–60% / 80–85%). A star player still lifts a team, but cannot beat it alone.
- Match-day form → each team gets a normal form for the match (sd 0.7 OVR), for upsets.
- Technique level → passes and dribbles also get (A − ref)/scale (absolute skill), because §9 wants academy passing (70–78%) worse than first-league passing (78–86%) and the A − D formula alone cannot tell levels apart.
- Shooting reference → the "60" in p_onTarget is league-relative: 60 + (match level − 60); otherwise first-league players hit the target 80% of the time.
- Keepers of weaker leagues → p(goal | on target) += (ref − GK_eff)/scale, so academy matches have a few more goals than first-league ones (§9).

## Decisions
- Utility → roleWeight × skillFit × p × reward × riskFactor as in §4.2; reward is the value of the ball at the target (rises with the square of the distance to goal, less on the wings in the last third); a shot's reward is `value.goal` × p(goal | on target).
- Risk → riskFactor = riskByRow[row]^exp with an exponent per action (dribble 1.5, through ball 0.8, clear −1.5 …), so risky actions fade near the own goal and clearing grows there; late in the game the leading side multiplies risky actions by 0.8, the trailing side by 1.25.
- Open teammate → OPEN_TEAMMATE_BONUS multiplies the reward of a pass to an unmarked teammate when the holder is double-teamed (half of it under single pressure); the spec says "added", a multiplier fits the utility scale.
- Pass types → back pass when the receiver is a defender/keeper more than 8 units behind; short ≤ 26, long ≤ 62; long passes lose 0.012 logit per unit beyond 30.
- Pressure per pass type → the spec table's long/through (−0.5/−1.0) and cross (−0.4/−0.8) are the short-pass values scaled by 5/6 and 4/6.
- Marked receiver → −0.6 (one opponent within `OPEN_RADIUS`), −1.2 (two or more) (§7); the defenders pressing the holder are not counted as markers, so a double-team leaves someone open.
- Through balls → to attackers near the last line; the target is 8 units behind it; a completed one in the final third becomes a one-on-one shot (zoneBase +0.3, GK_POS matters).
- Cross → from wide in rows 5–6; keeper claim first (GK_HAN, PHY vs the crosser's PAS), then the best header among the attackers against one of the best defending headers.
- Hold-up → keeps the ball and lowers the pressure of the next action (teammates arrive); a failed hold-up wins a foul a quarter of the time.

## Positions and pressure
- Shape → 4-3-3 base spots; in possession the team pushes up (defenders up to about halfway, full-backs overlap on their side), without it the block drops behind the ball and slides across; the forwards come back towards their own half. The same `shapeSpot` draws the replay.
- Pressure → defenders stand at their shape spot ±5 (random); the nearest one closes down (distance × (1 − closeDown)) and counts if within 7, a second one within 9 (half close-down).
- Counter-attacks → after the ball is won in open play the side that lost it is out of shape for 3 actions (its spots 70% of the way to its attacking shape); without this academy matches (many turnovers) produced too few chances.

## Duels, fouls, set pieces
- Tackles → the presser tries one before the holder acts (24% under pressure, 40% double-teamed); a failed tackle is a foul 66% of the time (less in the box), otherwise the defender is out of the play.
- Fouls → also when a beaten defender pulls the dribbler down (outside the box) and on failed dribbles (`dribble.foulShare` × (1.5 − DEF/100)).
- Cards → yellow chance 17% × (1 + (PHY − DEF)/60) per foul; second yellow or a 2% straight red sends off; a sent-off keeper is replaced by the bench keeper (an attacker makes way) or an outfielder goes in goal.
- Corners → from blocked shots, parries, crosses and clearances that go behind, balls cut out in the box and tackles won in the own box; 55% are swung in for a header duel, the rest played short.
- Free kicks → in row 5+ and central: direct shot 35% (under wall pressure), otherwise a cross 60% or played short; elsewhere played short with no pressure.
- Penalties → logit(0.76) + (0.6·SHO + 0.4·COM − GK_REF)/24; a save is followed by a rebound 40% of the time.
- Throw-ins → kept 85%; goal kicks → the keeper starts a normal possession (short or long by his options).

## Squad and ratings
- Substitutions → windows 58/68/77: one or two changes each (the most tired first, by stamina and minutes), an attacker for a defender when losing late, forced changes for injuries; at most 5; the persona, Odil, Abu and keepers are not changed for tiredness.
- Persona → always starts unless injured (game rule); a tired persona (fatigue > 70) leaves at 65', a pre-rolled injury takes them off at its minute — as in the old engine.
- Ratings → 6.0 + goals, assists, key passes, shots on target, dribbles, tackles, interceptions, passes, fouls, cards, result, clean sheet (≥ 60 minutes), keeper saves/goals conceded; all from `MATCH_CONFIG.rating`.

## Replay
- The 2D replay rebuilds the log and plays each highlight as the chain of actions that led to it (up to 7, starting where the ball was won); the last two actions of a goal or big chance run 1.4× slower.
- Players stand where `shapeSpot` puts them for the ball and the team in possession; pressing defenders stand between the ball and their goal; the receiver runs onto the pass; the keeper moves towards the shot. Faces come from the pixel avatar (characters and the persona have their own look; other players get a plain, deterministic one).
- Possession gap → see docs/MATCH_ENGINE_CALIBRATION.md ("Known gap").
- Persona setbacks → the main character's injury chance and card chance (yellow and straight red) are halved (`MATCH_CONFIG.persona`): about 2% injuries a match instead of 4%, about half as many cards. Other players are unchanged, so the calibration tables stay valid.
