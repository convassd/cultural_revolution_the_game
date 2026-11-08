# Fixed economy and persistent events: evaluation

Historical snapshot: these simulations were recorded before Support/Escalation switched to automatic highest-attack targeting (`WEAKEN` was then named Big-Character Poster). The following figures are not re-evaluated results for the newer automatic-target rules.

Recommended starting defaults: **E = 3 energy per own turn, K = 1 draw per own turn**. This is a prototype tuning choice, not evidence that the game is balanced. The strong first-seat advantage remains the dominant issue. No card stats or abilities were nerfed in response to this experiment.

## Implemented interpretation

- Shuffle 48 characters and 12 events together; split into two private 30-card decks. Both players start with five cards. Each player skips automatic drawing on their first turn, then draws K every own turn, even with five or more cards. No forced discard or fatigue.
- Reset energy to E before drawing. Selling any hand card permanently removes it and gains its printed cost, without entry/death effects. Sales have no turn limit and may exceed E; energy does not carry over.
- There is one global active event. Any event may be played from hand from turn one; a replacement discards the previous event to its original owner. No public pool, unlock delay or once-per-turn event limit remains.
- Ongoing attack auras affect both sides, new arrivals and current factions until replaced. Damage/healing/draw/HP-setting/removal happen **once on entry**, not every turn. January Storm checks both players independently for their own Gang of Four member. Global changes also apply to Wen Gong Wu Wei and Comprehensive Rectification.

## Method and limits

All games use the live TypeScript engine and the same legal actions as the UI, including selling. Deck shuffle, live dice and random-policy choices use separate seeded streams. Each seed is replayed with deck assignments swapped. Asymmetric policy comparisons also reverse policy seats, giving four games per seed. This reduces seat/deal confounding.

Planner = the current AI 2.0, with a 4,800-transition budget, whole-turn beam search, two hidden-card samples and limited opponent replies. It receives no hidden deck order or opponent hand. This is bounded heuristic search, not optimal play. Simulation uses the node budget without the browser worker's 650 ms deadline; slower browsers may make weaker moves. Random chooses uniformly among **all legal actions**, including selling and End Turn; it can waste resources and attacks. Beating it is a low bar, not a human-strength rating.

Discovery uses seeds 120001–120040. Validation uses 130001–130100; the final selected-parameter evaluation uses 150001–150200 and random comparison 150001–150100. Ability diagnostics use 160001–160100. Discovery/pilot/validation are not pooled as independent evidence of optimality. Games stop at 160 individual turns or 2,000 actions and are recorded as unresolved; length statistics exclude unresolved games. A turn is one player action phase, and two turns form one round.

Confidence intervals below are 95% percentile bootstrap intervals, resampling **whole seed groups** (4,000 resamples) rather than treating swapped games as independent. They quantify simulation sampling error, not model error or the uncertainty of human play.

## Parameter discovery

Greedy mirror, 80 games per E/K pair (18 pairs, 1,440 games). Lower first-seat win rate, a playable length and fewer forced sales guide selection. There is no single objective that proves an optimum.

| E | K | First-seat wins / completed | Unresolved | Mean turns, completed | Mean sales | Mean events played |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 | 51/66 (77.3%) | 14 | 10.77 | 19.82 | 0.16 |
| 1 | 2 | 62/80 (77.5%) | 0 | 9.85 | 13.18 | 0.47 |
| 1 | 3 | 69/80 (86.2%) | 0 | 9.04 | 16.24 | 0.54 |
| 2 | 1 | 55/80 (68.8%) | 0 | 13.99 | 14.57 | 0.38 |
| 2 | 2 | 63/80 (78.8%) | 0 | 10.04 | 12.65 | 0.47 |
| 2 | 3 | 71/80 (88.8%) | 0 | 8.66 | 14.66 | 0.70 |
| 3 | 1 | 52/80 (65.0%) | 0 | 11.28 | 9.76 | 0.71 |
| 3 | 2 | 62/80 (77.5%) | 0 | 9.72 | 11.55 | 0.60 |
| 3 | 3 | 65/80 (81.2%) | 0 | 8.79 | 12.94 | 1.19 |
| 4 | 1 | 56/80 (70.0%) | 0 | 10.00 | 7.41 | 0.57 |
| 4 | 2 | 60/80 (75.0%) | 0 | 8.90 | 10.28 | 0.53 |
| 4 | 3 | 66/80 (82.5%) | 0 | 7.70 | 10.86 | 0.97 |
| 5 | 1 | 57/80 (71.2%) | 0 | 9.69 | 6.01 | 0.90 |
| 5 | 2 | 61/80 (76.2%) | 0 | 8.26 | 9.06 | 0.70 |
| 5 | 3 | 69/80 (86.2%) | 0 | 7.34 | 9.91 | 0.90 |
| 6 | 1 | 56/80 (70.0%) | 0 | 9.53 | 5.60 | 0.78 |
| 6 | 2 | 66/80 (82.5%) | 0 | 8.15 | 8.35 | 0.82 |
| 6 | 3 | 69/80 (86.2%) | 0 | 7.49 | 9.74 | 1.00 |

E=1/K=1 is rejected: 14/80 games reach the limit, with heavy selling and starvation. K=2 or 3 generally shortens games and amplifies the first-seat snowball. E=2/K=1 is viable but asks players to sell more often to use the many three-cost characters. E=3/K=1 permits those natural plays while preserving a slower refill. Higher E gives relatively little first-seat relief.

## Planner validation

Same 100 validation seeds, 200 games per candidate. These differences are modest relative to sample size; the recommendation is a practical compromise, not a statistically established best point.

| E/K | First-seat win rate | Mean turns | Median / P90 | Unresolved |
| --- | --- | --- | --- | --- |
| 3/1 | 148/200 (74.0%) | 12.08 | 11 / 19 | 0 |
| 3/2 | 156/200 (78.0%) | 9.36 | 9 / 15 | 0 |
| 4/2 | 161/200 (80.5%) | 8.64 | 7 / 14 | 0 |

## Final selected-parameter results

**Planner mirror, 400 games:** first player wins **302/400 = 75.5%**, seed-cluster interval **72.0%–79.0%**. Mean length **11.74 individual turns**, interval **11.32–12.20**; median 11, P90 19, zero unresolved. This is about 5.87 rounds of action phases; a terminal half-round is included fractionally.

Mean per game: 6.82 sales, 0.86 event plays, 5.53 character trades, and 5.09 turn ends with an empty acting hand. K=1 improves tempo control at the cost of many turns with limited hand choices. Events are often sold instead of played.

**Planner versus Random, 400 games:** Planner wins **400/400**, comprising **200/200 going first** and **200/200 going second**. Mean length 6.62 turns, zero unresolved. Zero observed losses does not establish an underlying 100% win probability. The mixed-policy first-seat win rate is 50% only because the stronger policy wins from either seat; it must not be interpreted as balanced seat rules.

The likely explanation is structural (an inference from the rules and observed tempo, not an isolated causal test of selling): five initial cards plus full-price selling allow a large turn-one tempo burst; the opener converts that tempo into ready attackers before the responder gets an equivalent second action phase. E/K alters the rate of replenishment but does not remove that initial advantage. Suggested next experiment: constrain the **first turn's sale-generated energy** or test a separate second-player compensation. Neither change is implemented here.

## Cards: observations, not a nerf list

The following are signals in the 400 mirror games. Played win rate is selected by game state, deck partners, seat and AI policy: strong boards may enable an expensive play, while losing players may cast emergency events. It is **not** a causal estimate of card strength. Every card has 400 initial-owner observations, balanced across seats by swapped deals.

| Card | Played games | Wins when played | Sold games | Initial-owner win rate |
| --- | --- | --- | --- | --- |
| 刘少奇 (`liu_shaoqi`) | 69 | 41/69 (59.4%) | 41 | 200/400 (50.0%) |
| 叶剑英 (`ye_jianying`) | 65 | 33/65 (50.8%) | 47 | 198/400 (49.5%) |
| 王洪文 (`wang_hongwen`) | 156 | 89/156 (57.1%) | 0 | 200/400 (50.0%) |
| 聂元梓 (`nie_yuanzi`) | 112 | 58/112 (51.8%) | 3 | 204/400 (51.0%) |
| 华国锋 (`hua_guofeng`) | 131 | 83/131 (63.4%) | 15 | 228/400 (57.0%) |
| 谢富治 (`xie_fuzhi`) | 146 | 69/146 (47.3%) | 10 | 204/400 (51.0%) |
| 毛泽东 (`mao_zedong`) | 71 | 32/71 (45.1%) | 60 | 212/400 (53.0%) |
| 周恩来 (`zhou_enlai`) | 45 | 27/45 (60.0%) | 86 | 218/400 (54.5%) |
| 邓小平 (`deng_xiaoping`) | 20 | 5/20 (25.0%) | 92 | 192/400 (48.0%) |
| 炮打司令部 (`bombard_headquarters`) | 31 | 10/31 (32.3%) | 96 | 196/400 (49.0%) |
| 五一六通知 (`may_16_notice`) | 42 | 23/42 (54.8%) | 70 | 180/400 (45.0%) |

## Paired ability ablations

For each listed card, replay 200 planner-mirror games with its ability removed, keeping cost/body/initial deal/dice seed unchanged. All other cards and rules stay the same. Ownership is measured from the initial deck, including cards never drawn; this avoids conditioning the treatment on whether a card was played. A positive difference means the original ability helped its owner. This tests **ability contribution**, not the overall balance of the printed body, price or group membership. It can be underpowered when the card is rarely drawn or commonly sold.

| Ability removed from | Original helps / hurts | Net owner-win difference | Seed-cluster 95% interval |
| --- | --- | --- | --- |
| 刘少奇 | 2 / 1 | +0.5 percentage points | -1.0 to +2.5 pp |
| 叶剑英 | 0 / 0 | +0.0 percentage points | Not estimable: zero flips |
| 王洪文 | 5 / 1 | +2.0 percentage points | +0.0 to +4.5 pp |
| 聂元梓 | 2 / 2 | +0.0 percentage points | -2.0 to +2.0 pp |
| 华国锋 | 5 / 2 | +1.5 percentage points | -1.0 to +4.0 pp |
| 谢富治 | 2 / 5 | -1.5 percentage points | -4.0 to +1.0 pp |
| 毛泽东 | 5 / 5 | +0.0 percentage points | -3.0 to +3.0 pp |
| 周恩来 | 0 / 1 | -0.5 percentage points | -1.5 to +0.0 pp |

A zero-flip sample cannot estimate a useful population interval: the bootstrap would degenerate to zero and must not be read as proof of no effect.

No ability in this small exploratory panel has a robust positive effect separated from zero by these intervals. Multiple-card comparisons and AI search instability further caution against declaring a significant outlier. Tough and Charge remain useful watch-list mechanics; the played-card win rates alone do not justify nerfing Liu Shaoqi or Ye Jianying. Protection can be valuable defensively even when its played-win rate is low, because it is often played in losing positions.

The stronger reproducible imbalance in these tests is first-seat tempo, not a demonstrated single-card problem. High-cost characters also act as high-yield currency: several SSRs are sold often. Low event played-win rates may reflect emergency use or a weak event evaluation rather than strictly weak event effects. A better follow-up is a larger paired stat/body experiment or human play logs, after addressing first-seat tempo.

## Exploratory ownership screening across all 60 cards

For each card, group the two swapped games by seed. Ignore seeds where its original owner wins exactly one game; compare owner-wins-both to owner-loses-both using a two-sided exact binomial sign test. Apply Benjamini–Hochberg correction across all 60 exploratory tests. This measures association with a whole dealt deck, not the causal strength of the individual card; deck partners remain a confounder.

The highest positive signal is Hua Guofeng: initial-owner win rate **57.0%**, unadjusted p=0.0061, adjusted q=0.183. The strongest negative signal is July 20 Incident: 42.0%, p=0.0016, q=0.096. **No card passes a 5% adjusted threshold.** These associations and the ability ablations justify a watch list, not an automatic nerf/buff. A larger randomized card-replacement experiment would be stronger evidence.

| Card | Cost | Seen in hand | Played | Played win rate | Sold | Initial-owner win rate | Exploratory q |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 华国锋 | 5 | 162 | 131 | 63.4% | 15 | 57.0% | 0.183 |
| 江青 | 4 | 129 | 64 | 73.4% | 54 | 56.0% | 0.236 |
| 徐向前 | 4 | 108 | 66 | 68.2% | 29 | 56.0% | 0.236 |
| 陈毅 | 4 | 111 | 77 | 55.8% | 29 | 55.5% | 0.286 |
| 彭德怀 | 5 | 138 | 97 | 69.1% | 31 | 55.5% | 0.286 |
| 周恩来 | 6 | 141 | 45 | 60.0% | 86 | 54.5% | 0.394 |
| 吴德 | 3 | 122 | 91 | 56.0% | 21 | 54.0% | 0.456 |
| 戚本禹 | 3 | 139 | 112 | 58.9% | 24 | 54.0% | 0.456 |
| 怀仁堂事变 | 5 | 138 | 17 | 23.5% | 101 | 54.0% | 0.456 |
| 林彪 | 6 | 152 | 60 | 61.7% | 79 | 53.5% | 0.567 |
| 纪登奎 | 3 | 159 | 105 | 48.6% | 39 | 53.5% | 0.567 |
| 毛泽东 | 7 | 141 | 71 | 45.1% | 60 | 53.0% | 0.695 |
| 张春桥 | 4 | 126 | 87 | 54.0% | 24 | 53.0% | 0.695 |
| 九一三事件 | 4 | 149 | 16 | 37.5% | 113 | 52.0% | 0.928 |
| 陈伯达 | 4 | 142 | 79 | 63.3% | 49 | 51.5% | 0.969 |
| 陈再道 | 4 | 120 | 67 | 46.3% | 36 | 51.5% | 0.969 |
| 李先念 | 3 | 111 | 79 | 45.6% | 28 | 51.5% | 0.969 |
| 杨尚昆 | 3 | 122 | 82 | 52.4% | 33 | 51.5% | 0.969 |
| 四五天安门事件 | 3 | 134 | 19 | 36.8% | 92 | 51.5% | 0.969 |
| 姚文元 | 3 | 166 | 147 | 49.0% | 10 | 51.0% | 0.973 |
| 谢富治 | 4 | 168 | 146 | 47.3% | 10 | 51.0% | 0.973 |
| 罗瑞卿 | 4 | 137 | 86 | 57.0% | 40 | 51.0% | 0.973 |
| 聂元梓 | 3 | 119 | 112 | 51.8% | 3 | 51.0% | 0.973 |
| 清查五一六 | 3 | 136 | 15 | 46.7% | 85 | 51.0% | 0.973 |
| 毛远新 | 3 | 105 | 84 | 47.6% | 16 | 50.5% | 0.985 |
| 刘少奇 | 5 | 127 | 69 | 59.4% | 41 | 50.0% | 1.000 |
| 彭真 | 4 | 139 | 89 | 55.1% | 34 | 50.0% | 1.000 |
| 王洪文 | 4 | 167 | 156 | 57.1% | 0 | 50.0% | 1.000 |
| 杨成武 | 4 | 151 | 103 | 55.3% | 39 | 50.0% | 1.000 |
| 康生 | 4 | 129 | 49 | 44.9% | 65 | 49.5% | 0.985 |
| 叶剑英 | 5 | 127 | 65 | 50.8% | 47 | 49.5% | 0.985 |
| 关锋 | 3 | 106 | 89 | 55.1% | 10 | 49.5% | 0.985 |
| 黄永胜 | 5 | 133 | 84 | 47.6% | 33 | 49.5% | 0.985 |
| 谭震林 | 3 | 129 | 97 | 47.4% | 21 | 49.5% | 0.985 |
| 姚登山 | 2 | 148 | 109 | 49.5% | 29 | 49.5% | 0.985 |
| 邱会作 | 4 | 159 | 93 | 41.9% | 53 | 49.5% | 0.985 |
| 二月提纲 | 1 | 136 | 70 | 22.9% | 39 | 49.5% | 0.985 |
| 陶铸 | 3 | 147 | 127 | 50.4% | 15 | 49.0% | 0.973 |
| 陈锡联 | 4 | 147 | 98 | 51.0% | 37 | 49.0% | 0.973 |
| 贺龙 | 5 | 131 | 81 | 51.9% | 32 | 49.0% | 0.973 |
| 炮打司令部 | 3 | 154 | 31 | 32.3% | 96 | 49.0% | 0.973 |
| 朱德 | 5 | 141 | 82 | 54.9% | 45 | 48.5% | 0.969 |
| 蒯大富 | 2 | 150 | 130 | 43.1% | 14 | 48.5% | 0.969 |
| 邓小平 | 5 | 123 | 20 | 25.0% | 92 | 48.0% | 0.928 |
| 吴法宪 | 4 | 129 | 72 | 51.4% | 35 | 48.0% | 0.928 |
| 林立果 | 2 | 150 | 115 | 43.5% | 24 | 48.0% | 0.928 |
| 陈云 | 4 | 136 | 47 | 53.2% | 83 | 48.0% | 0.928 |
| 一月风暴 | 3 | 124 | 24 | 62.5% | 69 | 48.0% | 0.928 |
| 文攻武卫 | 2 | 122 | 49 | 55.1% | 48 | 48.0% | 0.928 |
| 吴晗 | 2 | 125 | 98 | 46.9% | 25 | 47.5% | 0.908 |
| 汪东兴 | 3 | 102 | 80 | 47.5% | 15 | 47.0% | 0.695 |
| 叶群 | 3 | 153 | 100 | 42.0% | 43 | 46.5% | 0.567 |
| 李富春 | 3 | 104 | 81 | 37.0% | 16 | 46.0% | 0.456 |
| 李作鹏 | 4 | 142 | 78 | 44.9% | 51 | 45.5% | 0.394 |
| 王力 | 3 | 165 | 113 | 44.2% | 44 | 45.0% | 0.297 |
| 五一六通知 | 2 | 130 | 42 | 54.8% | 70 | 45.0% | 0.297 |
| 二月逆流 | 3 | 167 | 35 | 42.9% | 112 | 45.0% | 0.297 |
| 全面整顿 | 3 | 156 | 17 | 70.6% | 122 | 45.0% | 0.297 |
| 张玉凤 | 2 | 161 | 120 | 37.5% | 30 | 44.0% | 0.236 |
| 七二〇事件 | 3 | 118 | 10 | 60.0% | 90 | 42.0% | 0.096 |

## Reproduce and change parameters

Runtime defaults are one object, `DEFAULT_RULES` in `src/game/rules.ts`. Tests/simulations inject E/K as the third `createGame` argument. Multiplayer synchronizes the per-match rules snapshot and rejects incompatible older protocols. No settings UI or remote AI service was added.

```sh
node scripts/tune-economy.mjs grid 40 120001
node scripts/tune-economy.mjs matchup 100 130001 3 1 planner planner
node scripts/tune-economy.mjs matchup 100 130001 3 2 planner planner
node scripts/tune-economy.mjs matchup 100 130001 4 2 planner planner
node scripts/tune-economy.mjs matchup 200 150001 3 1 planner planner
node scripts/tune-economy.mjs matchup 100 150001 3 1 planner random
node scripts/tune-economy.mjs ablation 100 160001 3 1 planner planner
```

Arguments: mode, seed count, first seed, E, K, evaluated policy, opponent policy, optional planner node budget (default 4800). `grid` ignores the supplied E/K and scans E=1–6, K=1–3 with greedy mirror. `ablation` uses the evaluated policy for both seats. Reports are reproducible local JSON under `reports/`; JSON is ignored by Git. This Markdown report records the shareable conclusions.

Verification: 272 tests pass, including mixed-card conservation, fixed energy/draws, sell-then-charge lethal, event aura replacement, one-shot global effects, hidden-hand sales and serialized multiplayer. Production build/typecheck pass. A browser check exercised opening hands, selling above E, reset/draw, event persistence/replacement and 1366×768, 1280×720, 1920×1080 and 390×844 layouts.
