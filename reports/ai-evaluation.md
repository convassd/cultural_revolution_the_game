# One-step greedy AI versus face-attack strategies

This is a historical benchmark from before the five SSR ability revisions. Its win rates describe the earlier ruleset, not the current balance. The benchmark script can be rerun to evaluate the updated mechanics.

The in-game random AI was replaced with a greedy heuristic. Evaluation used 20 HP, initially with the human always opening and the AI second. The UI now assigns first/second seats randomly; combat rules and scoring were not changed.

Unconditional face attacks have clear counterexamples, but racing and first-seat advantage remain strong. These results do not establish that a second-seat AI usually beats a face-attack strategy.

## Method

- **greedy**: simulate each legal action once and score the resulting position. No recursion, opponent-response search or multi-turn planning. Average six possible outcomes for an unknown turn-start die.
- **face**: share greedy scoring for plays, ability targets and actions when direct attacks are unavailable. When face attacks are possible, prohibit character trades but allow plays and buffs first. This avoids exaggerating improvements with a deliberately weak card-playing baseline.
- **face-first**: make any available face attack before using the same scoring for plays or dealing with guards.
- **random**: the original uniformly random policy, including early turn ends.
- Final validation used independent seeds starting at 50001. Each face/HP experiment used 200 deck seeds, with strategies swapping seats for each seed; random used 100. All 1,800 matches finished normally. Earlier exploratory runs are excluded.
- Shared seeds give the same initial card allocation. Deck shuffling, live dice and random-policy choices use independent streams. Strategies do not inspect enemy hand contents, future draws or actual future dice.
- These are automated engine matches, not human games or real-browser interaction tests. They compare limited policies, not every possible strategy, and are not a prediction of win rates against human players.

## Results

| Opponent | Starting HP | Games | Greedy wins opening | Greedy wins second | Overall win rate | Mean alternating turns |
| --- | --- | --- | --- | --- | --- | --- |
| face | 20 | 400 | 181/200 (90.5%) | 65/200 (32.5%) | 61.5% | 10.58 |
| face-first | 20 | 400 | 185/200 (92.5%) | 69/200 (34.5%) | 63.5% | 10.61 |
| random | 20 | 200 | 100/100 (100.0%) | 100/100 (100.0%) | 100.0% | 10.68 |
| face | 30 | 400 | 191/200 (95.5%) | 72/200 (36.0%) | 65.8% | 12.45 |
| face | 40 | 400 | 193/200 (96.5%) | 89/200 (44.5%) | 70.5% | 14.11 |

When the AI always went second, the relevant figures were 32.5% against face and 34.5% against face-first. With randomly assigned seats, 61.5% / 63.5% are simulations against those fixed policies, not predictions against humans. Winning all 200 games against random establishes an improvement over that policy, not universal strength.

In the 20 HP face comparison, greedy traded 920 times, including 640 trades when a face attack was available. The face baseline made no voluntary trades, trading only when Protection blocked direct attacks.

## Counterexample: face is not always best

You have 3 HP and the opponent has 20 HP. Your ready Zhou Enlai has 3 attack / 9 health; the opponent has Nie Yuanzi with 3 attack / 3 health. Both hands and decks are empty.

- **Attack face**: the opponent falls to 17 HP. Nie attacks your player for three next turn, and you lose.
- **Trade**: Zhou kills Nie for three damage, takes four retaliation damage including faction advantage, and remains at five health. The enemy has no character, and you survive.

Tests cover this counterexample and prioritizing a lethal sequence of face attacks. They disprove strict optimality of always attacking face; the aggregate results still support the concern that short-game racing is very strong.

## Rule experiments proposed, not implemented

1. Try allowing **at most one character face attack per side per turn**. Choose which character attacks the player; others can trade. Ability damage would not consume that allowance. Re-evaluate rather than assuming it is balanced.
2. Improve early defense. Only two of 48 cards currently have Protection, at costs four and five. Consider four to six guards, including low-attack defenders costing two or three.
3. Address opening advantage separately, for example one extra temporary action point on the second seat's first turn. Apply the same rules to human and AI seats.
4. Raising HP alone is insufficient. The 30/40 HP experiments increased second-seat greedy wins only to 36.0%/44.5%, so more HP cannot be presented as a complete fix.

Start by evaluating the first experiment, tracking face attacks, voluntary trades and wins by seat. The original v0.0.0 prototype used the earlier rules; the current game has the revised SSR abilities described in the rules guide.

## Reproduce

```sh
npm run benchmark:ai -- 200 50001 face 20
npm run benchmark:ai -- 200 50001 face-first 20
npm run benchmark:ai -- 100 50001 random 20
npm run benchmark:ai -- 200 50001 face 30
npm run benchmark:ai -- 200 50001 face 40
```

Generated files appear as `reports/ai-<policy>-hp<HP>-<first-seed>-<count>.json`. They contain counts, seat outcomes and action/log traces for the first win and loss. They are reproducible local outputs and are ignored by Git; their logs retain the Chinese game text. The 30/40 HP parameters affect only benchmark simulations, not application rules or data.
