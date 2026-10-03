# Rules and abilities

These are the frozen `v0.0` mechanics. English names below explain the Chinese game text; the game itself remains in Chinese.

## Setup and turns

- Both players start with 20 HP. There are no hero classes or hero powers.
- Shuffle all 48 unique characters, then divide them into two 24-card decks. Each character appears only once per game.
- Seat 1 draws three starting cards; seat 2 draws four. The first turn draws one more, so both hands contain four cards when play begins.
- Seat 1 opens in hot-seat mode. AI mode randomly assigns the human to either seat with equal probability. The human is always displayed at the bottom.
- Each player's first turn has two maximum action points. Each later turn of that player increases the maximum by one, up to ten. Turn start refills the current amount and draws one card.
- Empty decks skip draws. There is no fatigue damage or hand-size limit.
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
| `BUFF_ONE` | 动员 / Mobilization | On entry, another friendly character gains +1 attack for this turn. Resting characters are eligible; the entering character cannot target itself. |
| `DRAW_ONE` | 串联 / Networking | On entry, draw one card. Skip if the deck is empty. |
| `REVEAL_HAND` | 内部消息 / Inside Information | Reveal a snapshot of the enemy's current hand to the caster for the rest of this turn. Later changes do not update it. |
| `GROUP_DRAW` | 碰头会 / Coordination Meeting | On entry, draw one card if another friendly member of the character's group was already in play. The entering character and enemy members do not count. |
| `CHARGE` | 冲击 / Assault | Can attack on the entry turn, still at most once per turn. |
| `WEAKEN` | 大字报 / Big-Character Poster | On entry, an enemy character loses one attack for this turn, including retaliation. |
| `GUARD` | 保卫 / Protection | While in play, enemy characters cannot directly attack its player. They can still attack any friendly character. |

Temporary attack changes stack with each other and with group auras. Effective attack cannot fall below zero. All temporary changes on both sides expire at turn end. Damage-reduction uses reset at the beginning of either player's turn.

For targeted entry abilities, clicking Play immediately spends resources and places the character on the battlefield. If eligible targets exist, target selection is mandatory before any further game action. If none exist, skip the entry effect. Drawing, revealing and other automatic entry effects resolve immediately.

## Unique abilities

### Mao Zedong — `MAO_RANDOM_COMMAND`

**最高指示 / Supreme Directive.** At each owner's turn start, roll one six-sided die:

- 1–2: Mao cannot attack this turn.
- 3–5: Mao can attack normally.
- 6: Deal two damage to every other character on both sides, then Mao cannot attack this turn.

The die does not directly restrict other friendly characters. There is no roll on entry.

### Zhou Enlai — `ZHOU_MEDIATION`

**斡旋 / Mediation.** During each owner's turn, the first other friendly character that would die from damage instead remains at one HP. Zhou takes two damage and can die from it. At most once per owner's turn; no trigger during the enemy turn, no self-rescue and no rescue from direct-death effects.

### Deng Xiaoping — `DENG_RETURN`

**三起三落 / Three Rises and Falls.** The first three deaths schedule a return at the next owner's turn start:

1. Two attack, two HP.
2. One attack, two HP; faction changes to Unaffiliated.
3. One attack, one HP; remains Unaffiliated.

The fourth death goes to the discard pile permanently. Returned Deng rests that turn. If all five slots are occupied, the return waits until another owner's turn start. Mediation did not cause a death and does not consume a return.

### Lin Biao — `LIN_COUNTDOWN`

**折戟沉沙 / A Shattered Halberd in the Sand.** Enter with a countdown of three. Each owner's turn end, including the entry turn, reduces it by one. At zero, Lin dies directly and all characters take two damage. Every Ye Qun and Lin Liguo on either side also dies directly. Ordinary combat death before zero does not cause the explosion.

### Jiang Qing — `JIANG_FULL_GROUP`

**四人帮集结 / Gang of Four Assembly.** The first time Jiang Qing, Zhang Chunqiao, Yao Wenyuan and Wang Hongwen are simultaneously on the same friendly battlefield, deal six damage to the enemy player. Once per game. The usual group aura still applies; Protection does not block the damage, which can end the game.

## Trigger and damage order

- Turn start: increase/refill action points and draw; reset damage reduction and the active player's Mediation use; ready existing friendly characters; process friendly pending returns; roll Mao's directive. Returns happen after attack readiness is restored, so returnees rest.
- Turn end: resolve Lin's countdown and explosion; clear temporary attack modifiers on both sides and the revealed-hand snapshot; switch the active player and begin the next turn.
- For an entry play, finish its entry ability before checking the once-per-game full-group damage trigger.
- Combat attack values are computed before damage. Area damage deducts HP simultaneously; process damage reduction, direct-death flags, Mediation, then removals and pending returns. Ability damage has no faction bonus.
- Zhou must remain alive after the initial batch to mediate. If several allies would die, save the first eligible character in friendly battlefield order.
- Direct deaths bypass damage reduction and Mediation. If a future direct-death ability targets Deng, his return rule still applies. Lin's current direct-death targets are only Lin, Ye Qun and Lin Liguo.
- If Mao kills a Deng who just returned at turn start, that death schedules a later owner's turn, not another return during the same start phase.

## Presentation and information

Faction backgrounds use pale blue for Conservatives, pale red for Rebels, pale green for Military, and beige for Unaffiliated. A live faction change also changes the card background.

Damage indicators show actual post-reduction damage; a fully reduced hit displays zero. Dead cards briefly stay in place, show cracks and shatter before survivors move together. Rules resolve immediately while animations play. Reduced-motion preferences suppress shaking, floating and fragments while preserving information.

Enemy hands show backs and counts unless revealed. Hot-seat handoff hides the next player's hand until confirmation. This is a shared-screen convenience, not protection against browser developer tools.

After final battle effects, the central result animation lasts about 3.6 seconds. AI games show **全面胜利** (Complete Victory) or **退出舞台** (Exit the Stage) from the human's perspective; hot-seat games show **玩家1胜利** or **玩家2胜利**. The turn bar retains the result after the animation fades. Sound is generated locally in the browser and stops on restart or exit.
