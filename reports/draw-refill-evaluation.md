# Five-card refill: small AI balance check

This comparison uses the existing one-step greedy AI without changing its scoring or introducing search. It compares the immediately previous rules with five starting cards for both seats and turn-start draws up to five. The five revised SSR abilities, 20 player HP, two initial action points, decks and other combat rules are the same in both runs.

For the subsequent search-based opponent under these rules, see [AI 2.0 evaluation](ai-v2-evaluation.md).

## Method

- Baseline: gameplay at commit `f521935` (v0.1.1), with four cards visible for each seat at setup and one ordinary draw at each later turn start. The second seat consequently reaches five at its first turn start.
- Updated: both seats start with five; automatic drawing refills to five before return and directive effects. Hands already at five or more skip the automatic draw; skill draws have no cap.
- Use deck seeds 61001–61050. For each policy matchup, swap seats on every seed: 100 simulation runs per matchup, 300 per ruleset, 600 total. All runs finish normally; none reaches the 1,500-action limit.
- Greedy mirror matches repeat the same 50 games when the policy labels swap, so their first-seat statistic has 50 independent deck seeds, not 100 independent games.
- Deck shuffle, live dice and random-policy choices use separate reproducible streams. Matching seeds preserve each seat's shuffled 24-card deck order. Actual later draws and dice consumption may diverge after different choices.
- `face` uses the same greedy scoring for cards and skill targets, but refuses character trades while a face attack is available. `face-first` goes further and attacks the player before other actions whenever possible. These are automated policies, not human play.
- Turn counts below are alternating individual player turns, not complete rounds.

## Results

| Matchup / metric | Previous draw rule | Five-card refill |
| --- | --- | --- |
| Greedy mirror: first-seat wins | 43/50 (86%) | 45/50 (90%) |
| Greedy mirror: mean turns | 13.30 | 12.42 |
| Greedy vs face: overall greedy wins | 62/100 (62%) | 62/100 (62%) |
| Greedy vs face: wins when opening | 47/50 (94%) | 46/50 (92%) |
| Greedy vs face: wins when second | 15/50 (30%) | 16/50 (32%) |
| Greedy vs face: mean turns | 10.86 | 10.30 |
| Greedy vs face-first: overall greedy wins | 62/100 (62%) | 64/100 (64%) |
| Greedy vs face-first: wins when opening | 46/50 (92%) | 46/50 (92%) |
| Greedy vs face-first: wins when second | 16/50 (32%) | 18/50 (36%) |
| Greedy vs face-first: mean turns | 10.84 | 10.34 |

In the updated face matchup, greedy makes 434 face attacks and 202 character trades; 150 of those trades happen when a face attack is also available. The face policy makes 423 face attacks and 52 compulsory trades. Thus, the current greedy policy still finds reasons to trade, but face racing remains effective.

## Interpretation

The refill update modestly shortens these simulated matches. It does not resolve the large first-seat advantage: mirror opening wins remain high, and a second-seat greedy AI still loses most games against both face policies. The two extra mirror opening wins and small changes in face win rates are insufficient to claim a meaningful balance improvement or deterioration.

More turn-start card access can improve immediate card options and make it easier to spend available resources. It also gives the opening player more options while that player already has the initiative; identical starting hand sizes do not compensate for that tempo advantage. This is a plausible explanation, not a measured causal result.

Draw abilities now compete with free future refills: their immediate value includes access to a card sooner, rather than guaranteed extra hand size next turn. Existing DRAW_ONE consumes its own hand card on entry and draws one replacement, so it does not by itself turn a five-card hand into six. It still draws with five remaining cards when starting from six, and excess cards are kept. No ability values were changed.

This is a quick check with a weak, fixed heuristic and only 50 paired deck seeds. It cannot establish human win rates or the optimal strategy. No additional balance rule was introduced based on this sample. A separate experiment could test second-seat first-turn resources or limits on direct player attacks, keeping the draw rule fixed.

## Reproduce the updated run

```sh
npm run benchmark:ai -- 50 61001 greedy 20
npm run benchmark:ai -- 50 61001 face 20
npm run benchmark:ai -- 50 61001 face-first 20
```

The CLI now accepts `greedy` for mirror checks and records the current initial-hand and refill-target constants in its output. Full JSON traces remain local and ignored by Git. The baseline was recorded before modifying the engine; historical source is unchanged.
