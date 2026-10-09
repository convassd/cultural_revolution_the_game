# Rules and abilities

These are the current mechanics, including the five revised SSR abilities. English names below explain the Chinese game text; the game itself remains in Chinese.

## Setup and turns

A **turn** is one player's action phase, from its start to its end. A **round** consists of one turn from each player. The engine counts individual turns (1, 2, 3, ...); the displayed round is `Math.ceil(turn / 2)`. A player-relative duration never expires merely because a round boundary is crossed.

- Both players start with 20 HP. There are no hero classes or hero powers.
- Shuffle all 48 unique characters, then divide them into two 24-card decks. Each character appears only once per game.
- Both seats draw five starting cards, leaving 19 cards in each deck. The opening turn does not draw extra cards when its hand already contains five.
- AI and online multiplayer randomly assign each player to either seat with equal probability. Seat 1 opens; your own hand and battlefield are always displayed at the bottom.
- Each player's first turn has two maximum action points. Each later turn of that player increases the maximum by one, up to ten. Turn start refills the current amount, then draws from the deck until the hand reaches five, before processing returns and other turn-start abilities.
- Five is a refill target, not a hand-size limit. A hand containing five or more skips the automatic draw and never discards excess cards. Entry abilities may draw even when the remaining hand already contains five or more cards.
- A refill stops when the deck is empty. There is no fatigue damage or hand-size limit.
- Each side has at most five characters in play. Playing pays the card's cost and removes it from the hand. There is no undo.

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
| `BUFF_ONE` | 声援 / Support | On entry, another friendly character gains +1 attack for this turn. Resting characters are eligible; the entering character cannot target itself. |
| `DRAW_ONE` | 串联 / Networking | On entry, draw one card. Skip if the deck is empty. |
| `REVEAL_HAND` | 调查材料 / Investigation Materials | Replace the enemy hand backs in the middle row with names from a snapshot of their current hand, with text and borders colored by printed faction (blue, red, green or beige). The caster's next selection or game action restores the backs. Scroll horizontally to read long hands. |
| `GROUP_DRAW` | 动员 / Mobilization | On entry, draw one card if another friendly member of the character's group was already in play. The entering character and enemy members do not count. |
| `CHARGE` | 冲击 / Assault | Can attack on the entry turn, still at most once per turn. |
| `WEAKEN` | 大字报 / Big-Character Poster | On entry, an enemy character loses one attack until the start of the caster's next turn. This affects retaliation immediately and attacks throughout the enemy's next turn. |
| `GUARD` | 保卫 / Protection | While in play, enemy characters cannot directly attack its player. They can still attack any friendly character. |

Temporary attack changes stack with each other and with group auras. Effective attack cannot fall below zero. “This turn only” modifiers (Support, Rectification and event attack changes) expire at the current player's turn end. Big-Character Poster expires at the start of the caster's next turn, before any turn-start effects, regardless of seat or round boundary. Its source leaving play does not remove the effect early; death clears it from the affected character before any return. Damage-reduction uses reset at the beginning of either player's turn.

For targeted entry abilities, clicking Play immediately spends resources and places the character on the battlefield. If eligible targets exist, target selection is mandatory before any further game action. If none exist, skip the entry effect. Drawing, revealing and other automatic entry effects resolve immediately.

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

## Public event cards

The 12 unique events in [events.json](../src/data/events.json) are shuffled into a separate shared deck. They never enter either player's character deck or hand. No events are shown or usable during individual turns 1–7. At the start of player 2's turn in round 4 (individual turn 8), reveal two public slots to the right of the characters. Both players use these same slots.

Select an event, then click Use Event to pay its action-point cost. Each player can use at most one event during each of their own turns, even if enough resources remain for another. Usage resets when the active player changes. Discard the used event permanently and immediately refill that same slot from the shared deck. There is no reshuffle or replenishment after all 12 cards are used. Event use requires no target selection and is blocked during unfinished entry-target selection.

| ID | Chinese name / English rendering | Cost / scope | Effect |
| --- | --- | --- | --- |
| `february_outline` | 「二月提纲」 / February Outline | 1 / global | All Rebels lose 1 attack this turn. |
| `may_16_notice` | 「五一六通知」 / May 16 Notice | 2 / global | All Rebels gain 1 attack and Conservatives lose 1 this turn. |
| `bombard_headquarters` | 「炮打司令部」 / Bombard the Headquarters | 3 / global | Set Liu Shaoqi and Deng Xiaoping in play to 1 HP; other Conservatives lose 1 attack this turn. |
| `january_storm` | 「一月风暴」 / January Storm | 3 / friendly | Friendly Rebels gain 2 attack this turn. Draw one character if a friendly Gang of Four member is in play. |
| `february_countercurrent` | 「二月逆流」 / February Countercurrent | 3 / global | Conservatives and Military gain 1 attack, Rebels lose 1 this turn. Chen Yi, Ye Jianying, Xu Xiangqian, Tan Zhenlin, Li Fuchun and Li Xiannian gain another 1. |
| `july_20_incident` | 「七二〇事件」 / July 20 Incident | 3 / global | Set Wang Li and Chen Zaidao in play to 1 HP; all Military and Rebels gain 1 attack this turn. |
| `wen_gong_wu_wei` | 「文攻武卫」 / Civil Attack, Armed Defense | 2 / friendly | Deal 1 damage to friendly Rebels, resolve deaths, then surviving friendly Rebels gain 2 attack this turn. |
| `purge_may_16` | 「清查五一六」 / Purge of May 16 | 3 / global | Deal 1 damage to all Rebels; Poisonous Weeds members take 2 instead, as one combined hit. |
| `september_13_incident` | 「九一三事件」 / September 13 Incident | 4 / global | Directly remove any Lin Biao in play, triggering his normal departure blast; other surviving Lin-group members lose 2 attack this turn. With no Lin present, only the attack reduction occurs. |
| `comprehensive_rectification` | 「全面整顿」 / Comprehensive Rectification | 3 / friendly | Heal each wounded friendly character by 1, capped at printed health; friendly Conservatives gain 1 attack this turn. |
| `april_5_incident` | 「四五天安门事件」 / April 5 Tiananmen Incident | 3 / global | Gang of Four members take 1 damage and survivors lose 1 attack this turn; also set Deng Xiaoping in play to 1 HP. |
| `huairentang_incident` | 「怀仁堂事变」 / Huairentang Incident | 5 / global | Directly remove all Gang of Four members on both sides; other surviving Rebels lose 1 attack this turn. |

Attack changes affect characters already in play when the effect resolves, use current faction overrides, stack with other temporary changes and auras, and expire at the end of the current player's turn. Later entrants do not inherit these changes. Effective attack remains at least zero. Global effects include both players; friendly effects refer to the event user.

Event damage has no faction bonus, uses normal reduction and Mediation, and can trigger deaths, Deng returns and Lin's departure blast. Area hits resolve together before removal waves. Wen Gong Wu Wei and similar damage-then-buff effects resolve deaths and blasts before applying attack changes to survivors. HP-setting bypasses damage reduction and Mediation without killing a character at 1 HP; it does not consume Tough or Deng's returns. Direct removal bypasses damage reduction and Mediation but retains ordinary departure/return triggers. Healing uses printed health even for returned Deng; it never lowers an already higher HP value. January Storm draws past the five-card target and skips an empty deck.

## Trigger and damage order

- Turn start: expire attack modifiers due at this turn start; increase/refill action points and draw up to the five-card target; reset damage reduction and both players' Mediation uses; ready existing friendly characters; process friendly pending returns and Rectification; roll Mao's directive. Returns happen after attack readiness is restored, so returnees rest.
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

Enemy hands show backs and counts unless revealed. Multiplayer sends the guest only its own hand, with hidden deck contents and enemy-hand placeholders. Shared event slots and discarded events are public; the remaining event order stays hidden from the guest and AI. The host runs the full state and remains trusted; this is casual P2P play rather than protection against host cheating.

After final battle effects, the central result animation lasts about 3.6 seconds. Both AI and online games show **全面胜利** (Complete Victory) or **退出舞台** (Exit the Stage) from the local player's perspective. The turn bar retains the result after the animation fades. Sound is generated locally in the browser and stops on exit or AI restart. After an online match finishes, only the host can start a new match; both browsers keep their connection and receive newly randomized seats.
