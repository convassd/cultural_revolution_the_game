# AI 2.0: turn planning and limited opponent replies

Historical ruleset note: these measurements precede the 12 public event cards and restoration of Lin Biao's countdown to three. The current planner supports events, but the numbers below do not describe current balance.

AI 2.0 is now the in-game opponent. It can find multi-action tactics that the old one-step greedy policy misses, but this first implementation has only a small aggregate advantage against that baseline and does **not** overcome the large first-seat advantage. No card stats or combat rules were changed for this experiment.

## Search and information

- Build complete own-turn action sequences, including plays, entry targets, attacks and End Turn. Keep an eight-position beam, up to 14 actions, then retain four completed candidates.
- Evaluate each candidate against a limited opponent-turn beam: two positions per depth, up to ten actions. Take the worst reply found for the original seat. This resembles minimax but is deliberately approximate: pruned replies and sequences are not exhaustively checked.
- Use the existing greedy position evaluator for pruning and leaf scores. Proven current-turn lethal sequences terminate search early.
- Sample two hidden-card worlds using public boards, discards, returns, own hand, unknown-card counts and any legitimately revealed enemy hand. Actual hidden hand identities and future deck order are removed before planning. No live RNG is consumed by search.
- Average Mao's distinct turn-start outcomes with weights 2/6, 3/6 and 1/6, including effects at both turn boundaries being searched. Other sampled card draws are approximations, not promises about actual future draws.
- Cache the sequence only while the next observation matches. Draws, reveals or other deviations trigger replanning. Never plan to play an imagined newly drawn own card before it is actually observed.
- Cap search at 4,800 simulated transitions. Browser searches additionally have a 650 ms deadline and run in a Web Worker; actions still appear one at a time with the existing presentation. Worker failure falls back to a legal greedy move. Returning home or restarting cancels the worker and discards stale responses.

## Validation method

Rules: 20 initial HP, two initial action points, revised SSR abilities, five starting cards for both seats and automatic turn-start refill to five. Skill draws can exceed five. Deck size and all other gameplay rules remain unchanged.

Final validation used deck seeds **81001–81100**, not the earlier exploratory seeds. For each matchup, swap the evaluated policy between seats for each seed. The deck shuffle, live dice and random-policy choices have independent reproducible streams. The node cap is applied in these engine simulations; the wall-clock browser deadline is not, to avoid machine-load-dependent decisions. All 600 runs completed without invalid actions or draws under the 1,500-action match limit.

Mirror policies reproduce the same match when their labels swap: each mirror group has 100 independent deck seeds, not 200 independent games. Shared seeds preserve initial allocation, but policies can change subsequent draw order and dice consumption. These are automated policy comparisons, not estimates against human players.

## Results

| Matchup | Evaluated policy wins opening | Wins second | Overall wins | Mean individual player turns |
| --- | --- | --- | --- | --- |
| AI 2.0 vs greedy | 88/100 (88%) | 17/100 (17%) | 105/200 (52.5%) | 11.805 |
| Greedy vs greedy | 92/100 (92%) | 8/100 (8%) | 100/200 (50%) | 11.480 |
| AI 2.0 vs AI 2.0 | 87/100 (87%) | 13/100 (13%) | 100/200 (50%) | 12.050 |

The 52.5% aggregate win rate is too close to even to claim a reliable large improvement. Winning 17% as second seat against greedy, versus 8% in the greedy mirror, suggests some compensation for initiative in this seed set, but most second-seat games are still lost. The 87% first-seat win rate in the AI 2.0 mirror shows the imbalance remains even when both sides plan.

AI 2.0 made 554 character attacks against greedy, including 428 when a direct player attack was legal. The opposing greedy policy made 450 character attacks, including 299 optional trades. More trades alone do not establish better decisions: beam pruning and the shared evaluator can still prefer weak lines.

The earlier 80-game exploratory run produced 55% overall and 20% as second seat. It is excluded from the validation table and is not stronger evidence than the independent result above. No tuning was performed against the validation seeds.

## Tactics and runtime checks

A regression fixture gives AI 2.0 three ready attackers with attack 5, 2 and 2, an enemy Protection character at 4 HP, and an enemy player at 5 HP. Greedy spends the 5-attack character on Protection and misses the win. AI 2.0 uses the two smaller attackers to remove Protection, then attacks the player with the 5-attack character for lethal. Tests also cover charge lethal, visible enemy lethal pressure, mandatory entry targets, cache invalidation, hidden-information invariance, cancellation and budget fallback.

Against greedy, 3,599 AI 2.0 decisions required 1,265 searches; 2,334 reused a continuation. Total decision time was 17.88 seconds, or 4.97 ms per decision including cached actions, with a slowest search/decision of 161.43 ms on the development machine. A repeat of the full 200-game comparison after final code checks reproduced the same wins and action counts. These figures are Node simulation timings, not promises for slower devices or dense late-game boards.

A real headless Chrome test served the production build under `/cultural_revolution_the_game/`, loaded the bundled worker, completed an AI match and checked returning home during an AI decision. The worker returned 11 actions, including four searches; no worker or page runtime errors occurred. A main-thread heartbeat continued during the match. This verifies the production worker URL and cleanup path in addition to mocked unit tests.

Final verification: all 231 tests passed, including two full seeded planner-versus-greedy matches that assert legal actions and conservation of all 48 unique cards at every step. Type checking and the production build passed.

## Limitations and next direction

The main weakness is selective search combined with the old evaluator, rather than a lack of browser capability. Four preselected candidates can omit a defensive line before opponent replies are considered. A two-position reply beam and two hidden-card samples can miss important threats. No persistent memory of previously revealed cards is maintained across turns. Depth limits can truncate especially long turns, after which later actual actions replan. The planner does not search a second full own turn after the response, learn from games, or guarantee an optimal move.

A useful next AI iteration would improve threat evaluation and candidate diversity, then test with fresh held-out seeds. Merely increasing depth would increase computation without fixing those assumptions. Balancing first-seat advantage would need a separate rules experiment; it was not silently changed here.

## Reproduce

```sh
npm run benchmark:ai -- 100 81001 greedy 20 planner
npm run benchmark:ai -- 100 81001 greedy 20 greedy
npm run benchmark:ai -- 100 81001 planner 20 planner
```

Arguments: seed count, first deck seed, opposing policy, starting HP, evaluated policy. Available policies: `planner`, `greedy`, `face`, `face-first`, `random`. Omit the final argument to retain the historical greedy default. JSON outputs include seats, action counts, search timings, limits and example replays; generated JSON stays gitignored. Timings vary between runs.
