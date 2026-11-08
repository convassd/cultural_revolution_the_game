# Rules and abilities

These are the current mechanics, including the five revised SSR abilities. English names below explain the Chinese game text; the game itself remains in Chinese.

## Setup and turns

A **turn** is one player's action phase, from its start to its end. A **round** consists of one turn from each player. The engine counts individual turns (1, 2, 3, ...); the displayed round is `Math.ceil(turn / 2)`. A player-relative duration never expires merely because a round boundary is crossed.

- Both players start with 20 HP. There are no hero classes or hero powers.
- Shuffle the 48 characters and 12 events separately, then split each type evenly. Each private deck has 24 characters and six events, interleaved as four characters followed by one event, repeated six times. Every card appears once per game. Opening hands therefore contain four characters and one event.
- A conditional draw such as Jiang Qing's draws the first matching card out of order, preserving the order of all others. No automatic re-interleaving occurs after skill draws. Ordinary extra draws take the next card as usual.
- Both players draw five starting cards, leaving 25 cards in each deck. Each player's first turn skips automatic drawing; subsequent turns draw exactly K cards before return/directive effects, regardless of hand size.
- AI and online multiplayer randomly assign each player to either seat. Seat 1 opens; your own hand and battlefield stay at the bottom.
- Energy resets to E at each own turn start and does not grow. Unspent energy is not saved for the next turn. Sell any hand card during the action phase to gain its printed cost in energy; the sold card is permanently removed, with no entry/death effect. Selling is unlimited and can take current energy above E.
- Current defaults: **E = 4, K = 3**. The second seat receives **+6 energy on its first turn only**, starting that turn with 10 current energy and base E = 4. There is no extra opening card, and subsequent turns reset to 4. This provisional compensation does not eliminate the measured first-seat advantage.
- Hand cards are retained without a limit or mandatory discard. Extra skill draws still work. An empty deck stops drawing without fatigue.
- E, K and `secondPlayerOpeningBonus` are stored in the match's `rules` object. Defaults live in `DEFAULT_RULES` in `src/game/rules.ts`; see the current [hand-flow evaluation](../reports/hand-flow-evaluation.md) for measured results. The earlier [economy report](../reports/economy-evaluation.md) is a historical snapshot.
- Each side has at most five characters in play. Playing pays the card's cost and removes it from the hand. There is no undo.
- Select a hand character and click any friendly battlefield slot, or drag it there; it appends to the board and aligns left, including when the clicked slot already contains a character. Select/drag an event to the active-event area to replace it. Select a hand card and click the left-hand trash slot, or drag it there, to sell it. The right column contains energy and End Turn only. Wrong destinations or insufficient resources do not consume the card.

There is no deck building, collection system, duplicate card, mulligan or saved game.

## Combat

A newly played character cannot attack until its next owner's turn, except when it has `CHARGE`. Each character attacks at most once per turn, targeting an enemy character or the enemy player.

Character combat is simultaneous: each deals its effective attack to the other, including its own faction advantage where applicable. Both attack values are determined before damage or deaths change any aura. Characters at 0 HP or below die and leave the battlefield.

Attacking a player deals the attacker's effective attack without retaliation or faction bonuses. A player reaching 0 HP loses immediately. `GUARD` prevents direct character attacks against that player, but does not force the attacker to target the guarding character or block ability damage.

## Factions and relationship groups

| In-game faction | English meaning | Deals +1 damage against |
| --- | --- | --- |
| 造反派 | Rebel faction | Conservative faction |
| 保守派 | Conservative faction | Military |
| 军队 | Military | Rebel faction |
| 无派别 | Unaffiliated | None; also receives no faction disadvantage |

The +1 applies only to that damage instance; it does not permanently raise attack. Retaliation computes its own bonus. There is no faction bonus against players.

| Group ID | In-game name | Members |
| --- | --- | --- |
| `gang_of_four` | 四人帮 / Gang of Four | Jiang Qing, Zhang Chunqiao, Yao Wenyuan, Wang Hongwen |
| `lin_group` | 林彪反党集团 / Lin Biao anti-party group | Lin Biao, Ye Qun, Lin Liguo, Huang Yongsheng, Wu Faxian, Li Zuopeng, Qiu Huizuo |
| `wang_guan_qi` | 大毒草 / Poisonous Weeds | Wang Li, Guan Feng, Qi Benyu |

A character belongs to at most one group. Count only living members on its own side: one gives no bonus, two give each member +1 attack, and three or more give each +2. The maximum is always +2. This dynamic aura changes immediately when members enter or leave; it never changes base data.

R, SR and SSR express card-mechanic complexity and collection tiers. Factions, group labels and rarity are game abstractions, rather than formal historical assessments.

## Reusable abilities

All eight are implemented. In-game names and descriptions come from [abilities.ts](../src/data/abilities.ts).

| Ability ID | Chinese name / English rendering | Behavior |
| --- | --- | --- |
| `TOUGH` | 申辩 / Defense | Reduce the first positive damage received in each global turn by one. Reducing one damage to zero still consumes the use; an original zero-damage hit does not. Applies to retaliation. |
| `BUFF_ONE` | 声援 / Support | On entry, automatically give the other friendly character with the highest current attack +1 attack for this turn. Ties use the leftmost character. Resting characters are eligible; the entering character is excluded. |
| `DRAW_ONE` | 串联 / Networking | On entry, draw one card. Skip if the deck is empty. |
| `REVEAL_HAND` | 调查材料 / Investigation Materials | Replace the enemy hand backs in the middle row with names from a snapshot of their current hand, with text and borders colored by printed faction (blue, red, green or beige). The caster's next selection or game action restores the backs. Scroll horizontally to read long hands. |
| `GROUP_DRAW` | 动员 / Mobilization | On entry, draw one card if another friendly member of the character's group was already in play. The entering character and enemy members do not count. |
| `CHARGE` | 冲击 / Assault | Can attack on the entry turn, still at most once per turn. |
| `WEAKEN` | 上纲上线 / Escalation | On entry, automatically reduce the highest-current-attack enemy character by one until the start of the caster's next turn. Ties use the leftmost character. This affects retaliation immediately and attacks throughout the enemy's next turn. |
| `GUARD` | 保卫 / Protection | While in play, enemy characters cannot directly attack its player. They can still attack any friendly character. |

Temporary attack changes stack with each other and with group auras. Effective attack cannot fall below zero. “This turn only” modifiers (Support and Deng's Rectification) expire at the current player's turn end. Active event attack auras persist until the event is replaced. Escalation expires at the start of the caster's next turn, before any turn-start effects, regardless of seat or round boundary. Its source leaving play does not remove the effect early; death clears it from the affected character before any return. Damage-reduction uses reset at the beginning of either player's turn.

All character entry abilities resolve in the play action, without manual target selection or a follow-up phase. Support and Escalation compare effective attack after the entering character has joined the battlefield, including current relationship, event, faction-override and temporary effects. Equal effective attack (including values floored to zero) ties by battlefield order. Skip the ability when its eligible side is empty; playing, selling and ending the turn remain immediately available. Ordinary attacks still use a player-selected enemy target.

## Unique abilities

### Mao Zedong — `MAO_RANDOM_COMMAND`

Seven cost, four attack, eight HP; Unaffiliated. **最高指示 / Supreme Directive.** On entry, heal the friendly player for five HP, with no cap at 20. At each owner's turn start, roll one six-sided die:

- 1–2: Mao cannot attack this turn.
- 3–5: Mao can attack normally.
- 6: Deal six damage to every character on both sides except this Mao and every Zhang Yufeng, then Mao cannot attack this turn.

The die does not directly restrict other friendly characters. There is no roll on entry. Zhang Yufeng's immunity applies only to this six-damage effect; Lin's explosion can still damage her and Mao.

### Zhou Enlai — `ZHOU_MEDIATION`

Six cost, three attack, nine HP; Unaffiliated. **调解 / Mediation.** During either player's turn, the first other friendly character that would die from damage instead remains at one HP. Zhou takes two damage and can die from it. At most once per global turn, resetting at the start of either player's turn. No self-rescue and no rescue from direct-death effects. Zhou must survive the initial damage batch to mediate.

### Deng Xiaoping — `DENG_RETURN`

**三起三落 / Three Rises and Falls.** The first three deaths schedule a return at the next owner's turn start:

1. Two attack, two HP.
2. One attack, two HP; faction changes to Unaffiliated.
3. One attack, one HP; remains Unaffiliated.

The fourth death goes to the discard pile permanently. Returned Deng rests that turn. If all five slots are occupied, the return waits until another owner's turn start. Mediation did not cause a death and does not consume a return.

Each actual return also triggers **整顿 / Rectification**: other living friendly Conservatives already in play gain temporary attack equal to that return's number (+1, +2 or +3). The modifier stacks with other attack bonuses and expires at the current turn's end. It does not apply to Deng himself, other factions or characters played later that turn. A deferred return grants no bonus until Deng actually enters; the bonus remains for the turn even if Deng dies again.

### Lin Biao — `LIN_COUNTDOWN`

**折戟沉沙 / A Shattered Halberd in the Sand.** Enter with a countdown of three. Each owner's turn end, including the entry turn, reduces it by one. At zero, Lin dies directly. Any actual departure through death, whether from countdown, combat or an ability, deals two damage to all remaining characters on both sides. Every Ye Qun and Lin Liguo on either side also dies directly. Mediation saving Lin at one HP prevents departure and therefore prevents the explosion; countdown death bypasses Mediation. Departure effects can cause further deaths and returns.

### Jiang Qing — `JIANG_BORROW_POWER`

Four cost, three attack, five HP. **借势 / Borrowed Power.** On entry, draw the first Rebel in deck order, leaving the other cards in their previous order. Skip the draw if none remain. While a living friendly Mao Zedong is in play, Jiang gains +2 attack as a dynamic aura. An enemy Mao grants no bonus. This stacks with her usual relationship-group aura and temporary attack modifiers; Mao leaving removes it immediately. Completing the Gang of Four no longer deals damage to the enemy player.

## Persistent global events

Events are private hand/deck cards and can be played or sold from the opening turn. Playing pays the cost, removes the event from hand and replaces the one shared active event. The old event enters its original owner's discard pile. Events never occupy a character slot. Multiple events may be played in one turn if affordable.

Every event affects both sides. Continuous attack auras last until replacement, affect later arrivals/returns and use current factions and group memberships. The old aura stops immediately on replacement; independent character skill durations retain their own deadlines. Damage, healing, drawing, setting HP to one and direct removal occur once on entry, not every turn. Replacing the event never reverses those one-shot effects.

January Storm checks each player independently for a friendly Gang of Four member and draws one mixed-deck card for each qualifying player. Wen Gong Wu Wei damages Rebels on both sides once. Comprehensive Rectification heals wounded characters on both sides once, capped at printed health. HP-setting and direct removal retain the existing damage/death semantics.

| ID | In-game name | Cost | Current card text |
| --- | --- | --- | --- |
| `february_outline` | 「二月提纲」 | 1 | Aura: Rebels -1 attack until replacement. |
| `may_16_notice` | 「五一六通知」 | 2 | Aura: Rebels +1 attack; Conservatives -1. |
| `bombard_headquarters` | 「炮打司令部」 | 3 | Entry: set Liu Shaoqi and Deng Xiaoping to 1 HP. Aura: other Conservatives -1 attack. |
| `january_storm` | 「一月风暴」 | 3 | Aura: Rebels +2 attack. Entry: each player with a friendly Gang of Four member draws one card. |
| `february_countercurrent` | 「二月逆流」 | 3 | Aura: Conservatives/Military +1 attack; Rebels -1. Chen Yi, Ye Jianying, Xu Xiangqian, Tan Zhenlin, Li Fuchun and Li Xiannian gain another +1. |
| `july_20_incident` | 「七二〇事件」 | 3 | Entry: set Wang Li and Chen Zaidao to 1 HP. Aura: Military/Rebels +1 attack. |
| `wen_gong_wu_wei` | 「文攻武卫」 | 2 | Entry: deal 1 damage to all Rebels. Aura: Rebels +2 attack. |
| `purge_may_16` | 「清查五一六」 | 3 | Entry: deal 1 damage to Rebels; Poisonous Weeds members take one combined 2-damage hit instead. |
| `september_13_incident` | 「九一三事件」 | 4 | Entry: directly remove Lin Biao, triggering his departure blast. Aura: other Lin-group members -2 attack. |
| `comprehensive_rectification` | 「全面整顿」 | 3 | Entry: heal all wounded characters by 1, capped at printed health. Aura: Conservatives +1 attack. |
| `april_5_incident` | 「四五天安门事件」 | 3 | Entry: set Deng to 1 HP and deal 1 damage to Gang of Four members. Aura: Gang members -1 attack. |
| `huairentang_incident` | 「怀仁堂事变」 | 5 | Entry: directly remove every Gang of Four member. Aura: other Rebels -1 attack. |

## Trigger and damage order

- Turn start: expire attack modifiers due at this turn start; reset action points to E and draw K cards (skip each player's first draw); reset damage reduction and both players' Mediation uses; ready existing friendly characters; process friendly pending returns and Rectification; roll Mao's directive. Returns happen after attack readiness is restored, so returnees rest.
- Turn end: resolve Lin's countdown and explosion; clear only this-turn attack modifiers on both sides and the revealed-hand snapshot; switch the active player and begin the next turn.
- Entry plays resolve their entry ability immediately, except mandatory target selection when a target is required. Mao's healing and Jiang's faction-specific draw do not require a target.
- Combat attack values are computed before damage. Area damage deducts HP simultaneously; process damage reduction, direct-death flags, Mediation, then removals and pending returns. Remove a lethal batch before processing Lin's departure explosion; process any resulting deaths in the next wave. Each departure resolves once. Ability damage has no faction bonus.
- Zhou must remain alive after the initial batch to mediate. If several allies would die, save the first eligible character in friendly battlefield order.
- Direct deaths bypass damage reduction and Mediation. Deng's return rule still applies to direct removal if targeted; events currently remove Lin or Gang of Four members, while Lin's blast directly removes Ye Qun and Lin Liguo.
- If Mao kills a Deng who just returned at turn start, that death schedules a later owner's turn, not another return during the same start phase.

## Presentation and information

Faction backgrounds use pale blue for Conservatives, pale red for Rebels, pale green for Military, and beige for Unaffiliated. A live faction change also changes the card background.

Damage indicators show actual post-reduction damage; a fully reduced hit displays zero. Events setting HP to one also show the amount of HP lost without invoking damage-rule triggers. Dead cards leave the live board immediately; a pointer-transparent visual copy shows cracks and shatters at its old position. Clickable cards show current HP, attack readiness and targets, even while older effects are still playing. Surviving cards retain their visual slots until death effects on that side finish, then close the gaps. This visual delay does not block attacks, plays or turn changes. Each animation finishes independently; players and AI need not wait for it to make the next legal move. Multiplayer still waits for state synchronization, not animations. Reduced-motion preferences suppress shaking, floating and fragments while preserving information.

When the opponent ends their turn and local controls become available, a brief two-note sound announces your turn. Initial setup and your own actions do not play this cue. Browser audio is unlocked by the start/create/join click and needs no downloaded audio assets.

Enemy hands show backs and counts unless revealed. Multiplayer sends the guest only its own hand, with hidden deck contents and enemy-hand placeholders. The active event, discarded cards and sold cards are public. Unplayed events in hands/decks stay hidden from the guest and AI. The host runs the full state and remains trusted; this is casual P2P play rather than protection against host cheating.

After final battle effects, the central result animation lasts about 3.6 seconds. Both AI and online games show **全面胜利** (Complete Victory) or **退出舞台** (Exit the Stage) from the local player's perspective. The turn bar retains the result after the animation fades. Sound is generated locally in the browser and stops on exit or AI restart. After an online match finishes, only the host can start a new match; both browsers keep their connection and receive newly randomized seats.
