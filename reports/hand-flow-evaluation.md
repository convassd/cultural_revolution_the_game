# Hand flow, fixed resources and opening compensation

Historical snapshot: these measurements predate v0.3.0's separately shuffled, equally split, 4-character/1-event interleaved decks. They guided the retained E/K defaults, but are not balance measurements of that newer dealing rule. Re-running the commands below now uses the current deal and will produce different results.

Use **E = 4 energy, K = 3 draws**, with **+6 energy on the second seat's opening turn only**, as the next playtest defaults. The second seat opens with 10 current energy and base E = 4; subsequent turns reset to 4. Both players still start with five cards and skip their opening automatic draw. No character, ability, event, HP or sale value was changed for this experiment.

This addresses resource starvation. It does **not** establish balanced or strategically deep gameplay: held-out planner mirrors still favor the first seat, and games remain short.

## Selection priorities

The previous E = 3, K = 1 recommendation placed too much emphasis on first-seat results. A lower initiative advantage is not useful if achieved by leaving players unable to play cards. This experiment instead uses the following order:

1. Restore a productive play after spending the opening hand or ending a turn empty-handed.
2. Offer multiple distinct hand-card options, rather than counting sale-order permutations as choices.
3. Measure cards seen, actually played and permanently sold separately.
4. Monitor game length and capacity constraints.
5. Freeze E/K, then calibrate a separate opening compensation. First-seat win rate is a diagnostic, not the E/K objective.

There is no weighted score claiming to measure fun. The selection is a playtest judgment over these tradeoffs.

## Method and definitions

All simulations use the current TypeScript engine, including automatic Support/Escalation targets and persistent mixed-deck events. Each seed runs twice with the private deck assignments swapped. Shuffle, live dice and random-policy choices have separate seeded streams. Asymmetric matchups also reverse policy seats, producing four games per seed.

- **Planner:** the existing AI 2.0, 4,800 engine transitions, whole-turn beam search, hidden-card samples and limited opponent replies. No live hidden hand/deck order is passed into planning. Simulations omit the browser worker's 650 ms deadline, so slower devices can play differently.
- **Greedy:** the retained one-step baseline, used for the broad screening sweep.
- **Spender:** a simulation-only stress policy. It prioritizes affordable characters, plays immediately beneficial events, and considers selling one or two cards to fund a concrete heuristic-improving play. It does not sell solely to accumulate energy. This is neither optimal play nor a human model, and it does not replace the game's AI.
- **Random:** uniformly samples legal actions, including selling and ending its turn. It is a weak baseline.

Measurements are taken at the start of an action phase, after draws and turn-start effects. A productive character play needs an open battlefield slot. An event is counted only if playing it changes current HP, effective attack, board membership or draws a card. A setup aura with no current effect is conservatively excluded. Effects can be harmful: these are mechanical opportunities, not certified good tactics.

**Recovery** means at least one productive hand card can be played, directly or by selling other hand cards. The candidate itself cannot fund its own play. **Two choices** means at least two distinct candidate card IDs qualify; it does not imply both can be played together. The calculation does not search further draw chains.

Conditional play rates exclude full friendly battlefields and starts with neither a hand nor remaining deck. They do not describe attack availability or general inactivity. **Post-opening** means none of that seat's original five cards remains in hand, after its first turn. **From empty** means that seat ended its previous turn with no hand. Fast games can bias these cohorts; the separate synthetic probes below address this limitation.

**Seen** counts distinct cards drawn by their owners across both players, including opening cards. **Played** counts distinct hand cards played, excluding automatic returns. **Sold** counts permanent sales. The total pool contains 60 unique cards. These figures are per match, not per player, and seen cards must not be described as played cards.

Caps are 160 individual turns or 2,000 actions. Unresolved games remain unresolved rather than being assigned to the player with more HP. A turn is one player's action phase; a round contains two turns.

## Broad screening

Greedy mirrors, seeds 210001–210040, 80 games per configuration. The provisional second-seat bonus is fixed at +2 throughout this stage.

| E | K | Mean turns | Mean seen / 60 | Mean played | Mean sold | First-seat wins |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | 1 | 11.93 | 20.65 | 9.33 | 10.33 | 52/80 |
| 4 | 2 | 9.48 | 26.08 | 13.28 | 10.85 | 64/80 |
| 4 | 3 | 7.80 | 28.61 | 15.26 | 10.65 | 68/80 |
| 5 | 2 | 8.65 | 24.29 | 12.91 | 9.39 | 64/80 |
| 5 | 3 | 7.38 | 27.23 | 14.56 | 9.73 | 68/80 |
| 6 | 2 | 8.18 | 23.45 | 13.39 | 8.09 | 66/80 |
| 6 | 3 | 7.11 | 26.55 | 14.61 | 9.04 | 67/80 |

Increasing E shortened games and reduced card exposure. K = 3 supplied more options than K = 2. Keeping a longer game by starving draws would obscure the underlying pacing problem.

## Empty-hand probes

Seeds 240001–241000: 1,000 matched draws per configuration in each of two synthetic turn-five contexts, 14,000 probes total. The previous hand is empty, energy resets to E, and exactly K cards are drawn. One context has an empty battlefield; the other has two ordinary characters on each side, with open slots. No SSR or relationship engine is pre-installed. Opening compensation cannot affect these turn-five results.

The empty context draws from the full mixed pool; the populated context excludes its four fixed in-play characters. These are standardized supply tests, not a claim about the distribution of real late-game decks.

| E / K | Empty field: recovery | Empty field: two choices | Populated: recovery | Populated: two choices |
| --- | --- | --- | --- | --- |
| 3 / 1 | 34.3% | 0.0% | 46.5% | 0.0% |
| 4 / 2 | 96.5% | 64.3% | 99.9% | 93.0% |
| 4 / 3 | 99.3% | 90.7% | 100.0% | 99.8% |
| 5 / 2 | 96.7% | 64.6% | 99.9% | 93.4% |
| 5 / 3 | 99.3% | 90.7% | 100.0% | 99.8% |
| 6 / 2 | 96.7% | 64.6% | 99.9% | 93.5% |
| 6 / 3 | 99.3% | 90.7% | 100.0% | 99.8% |

E = 4 already funds most viable plays when other new cards can be sold. Raising E helps direct affordability but adds little to funded recovery. Raising K supplies additional actual card choices.

## E/K confirmation with two policies

Seeds 230001–230040, 80 games per row, all at opening bonus +2. The old-parameter control was run for 60 seeds; only its matching first 40 seeds appear in this comparison.

Planner mirrors:

| E / K | Post-opening eligible starts | Recovery | Two choices | Mean seen | Mean played | Mean turns | First-seat wins |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3 / 1 | 760 | 69.1% | 33.3% | 21.71 | 12.68 | 12.84 | 47/80 |
| 4 / 2 | 524 | 97.9% | 92.4% | 26.90 | 15.90 | 10.14 | 61/80 |
| 4 / 3 | 369 | 100.0% | 98.9% | 29.03 | 15.86 | 7.96 | 63/80 |
| 5 / 2 | 429 | 100.0% | 96.7% | 25.35 | 15.74 | 9.05 | 58/80 |
| 5 / 3 | 309 | 100.0% | 99.7% | 27.93 | 15.90 | 7.58 | 66/80 |

Spender mirrors:

| E / K | Post-opening eligible starts | Recovery | Two choices | Mean seen | Mean played | Mean turns |
| --- | --- | --- | --- | --- | --- | --- |
| 4 / 2 | 440 | 100.0% | 96.4% | 24.94 | 16.28 | 8.89 |
| 4 / 3 | 355 | 100.0% | 98.6% | 28.85 | 17.55 | 7.88 |
| 5 / 2 | 378 | 99.7% | 96.0% | 23.73 | 16.05 | 8.26 |
| 5 / 3 | 305 | 100.0% | 99.3% | 27.21 | 17.05 | 7.34 |

Select **4 / 3** for its reliable replenishment, additional choices and greater exposure than higher E. It does not dominate 4 / 2 in every metric: the latter allows more time before lethal. That is a pacing tradeoff to revisit after human testing, not evidence that 4 / 3 is mathematically optimal.

## Separate opening-bonus calibration

With E/K frozen at 4/3, planner mirrors use seeds 250001–250050, 100 games per bonus. No unresolved games occurred.

| Second-seat opening bonus | First-seat wins | Mean turns | Mean seen | Mean played |
| --- | --- | --- | --- | --- |
| +0 | 86/100 | 7.52 | 27.43 | 14.94 |
| +2 | 80/100 | 8.02 | 28.92 | 15.99 |
| +4 | 71/100 | 8.21 | 29.64 | 16.89 |
| +6 | 65/100 | 8.35 | 30.08 | 17.28 |
| +8 | 63/100 | 8.47 | 30.36 | 17.59 |
| +10 | 59/100 | 8.07 | 29.19 | 17.09 |

Use **+6 provisionally**: it substantially reduces the observed opening advantage, while further increases show smaller improvements in this sample and do not clearly improve exposure or game length. This is a conservative playtest choice rather than a statistically established breakpoint. Even +10 does not demonstrate equal seats. No permanent income, extra card or new special action is introduced.

## Held-out validation

Seeds 260001–260100 were not used to select E/K or compensation. Each policy runs 200 mirrors at E = 4, K = 3, bonus = 6. All 400 games finish within the caps.

| Metric | Planner mirror | Spender mirror |
| --- | --- | --- |
| First-seat wins | 136/200 = 68.0% | 141/200 = 70.5% |
| Mean individual turns | 8.39 | 7.74 |
| Median / 90th-percentile turns | 8 / 12 | 7 / 11 |
| Mean cards seen | 30.31 / 60 = 50.5% | 28.55 / 60 = 47.6% |
| Mean cards played | 17.47 / 60 = 29.1% | 18.04 / 60 = 30.1% |
| Mean cards sold | 8.52 | 8.62 |
| Mean events played | 1.49 | 1.95 |
| Post-opening recovery | 99.0% of 1,016 starts | 99.9% of 891 starts |
| Post-opening two choices | 98.9% | 99.7% |
| Empty-hand recovery | 99.7% of 593 starts | 99.8% of 560 starts |
| Games reaching a post-opening observation | 198/200 | 194/200 |

For the planner mirror, 95% percentile bootstrap intervals are **63.0–73.5%** for first-seat wins, **7.99–8.83** for mean turns, **29.12–31.55** for mean cards seen and **16.70–18.26** for mean played. Bootstrap uses 4,000 resamples of whole seed groups, retaining both swapped games together. These intervals describe simulation sampling uncertainty, not AI quality or human experience.

The full old-parameter control (E = 3, K = 1, bonus = 2; seeds 230001–230060, 120 planner mirrors) averaged 12.24 turns, 21.03 cards seen and 12.16 played. Empty-hand recovery was only 43.4% across 588 eligible starts. This is useful context, but differs in both economy and compensation from the held-out defaults; use the fixed-bonus table above to isolate E/K.

Additional held-out cross-policy seeds 270001–270040 reverse seats and decks, 160 games per matchup:

- Planner beats Spender **92/160 = 57.5%**: 67/80 when first, only 25/80 when second. This is strong evidence that initiative can outweigh the planner's advantage over this stress policy; it does not establish a large skill gap.
- Planner beats Random **160/160**, including all 80 games from the second seat. Random is a deliberately weak baseline; this result is not a human-strength rating or proof of strategic depth.

No card-strength ranking or balance nerfs are inferred from played-card win rates in these runs. Those rates are heavily selected by seat, affordability, draws and the current board.

## Remaining issues and next useful experiment

The resource drought is largely removed, but average matches still end around four rounds and roughly half the pool remains unseen. At 20 player HP, early full-price sales and attacks without retaliation can convert the opening deployment advantage into lethal quickly. This is a mechanism-based explanation consistent with the observations, not a causal ablation of each rule.

Keep 4/3 fixed during the next human playtest. If pacing still feels too compressed, separately compare player HP 20/25/30, then recheck the opening bonus. Another possible lever is first-turn sale tempo. Do not lower supply simply to produce a prettier first-seat percentage. Neither HP changes nor sale restrictions are implemented here.

With no fatigue or draw adjudication, selling/destroying every character can leave both players alive with empty boards, decks, hands and return queues. A random mirror regression exposed this genuine exhausted stalemate. Tests now accept only that explicitly verified state as an alternative to victory, not an arbitrary timeout. No new draw rule was silently added; deciding how to end such games remains a TODO.

## Reproduction

No extra dependencies are required. Run from the repository root; use `npm.cmd` on PowerShell if needed.

```sh
node scripts/test-hand-flow.mjs screen 40 210001
node scripts/flow-experiment.mjs discovery 40 230001
node scripts/test-hand-flow.mjs match 60 230001 3 1 2 planner
node scripts/flow-experiment.mjs probes 1000 240001
node scripts/flow-experiment.mjs bonus 50 250001
node scripts/flow-experiment.mjs bonus-high 50 250001
node scripts/flow-experiment.mjs validate 100 260001 6
node scripts/flow-experiment.mjs cross 40 270001 6
npm test
npm run typecheck
npm run build
```

Raw JSON results are written under `reports/` and are gitignored. `hand-flow.ts` contains the metrics and Spender policy; `flow-simulation.ts` handles matched probes and turn cohorts. `screen` always uses Greedy mirrors and the seven fixed configurations, rather than the runtime defaults. A separate E = 5, K = 2 Spender pilot (60 games, seeds 220001–220030) was exploratory only and is not pooled into validation.

Verification: 293 tests pass, type checking and the production build pass. A production-preview browser smoke check verifies five-card openings in both human seats, the AI/human +6 opening bonus and reset, fixed three-card retained-hand draws, sales, persistent event replacement and no runtime errors. Desktop hand bounds and 3:4 card proportions pass at 1280×720, 1366×768 and 1920×1080; 390px portrait remains scrollable without page-width overflow. The smoke check stubs AI actions to isolate UI rules; AI quality is measured by the engine simulations above.
