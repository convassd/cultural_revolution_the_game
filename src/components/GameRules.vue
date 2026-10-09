<script setup lang="ts">
import { characters } from '../data'
import { eventCards } from '../data/events'
import { ABILITIES, DENG_RECTIFICATION_NAME } from '../data/abilities'
import { BOARD_LIMIT, EVENT_UNLOCK_TURN, GROUP_NAMES, INITIAL_HAND_SIZE, INITIAL_HP, INITIAL_MANA, MAX_MANA, TARGET_HAND_SIZE } from '../game/rules'
import type { AbilityId } from '../game/types'

const reusableIds: AbilityId[] = ['TOUGH', 'BUFF_ONE', 'DRAW_ONE', 'REVEAL_HAND', 'GROUP_DRAW', 'CHARGE', 'WEAKEN', 'GUARD']
const uniqueCharacters = characters.filter(card => card.rarity === 'SSR' && card.abilityId)
</script>

<template>
  <section class="game-rules" aria-label="游戏规则">
    <h2>游戏规则</h2>
    <p class="rules-intro">打出人物，选择攻击目标，将对方的生命降到 0。先读基础玩法，再了解卡牌技能。</p>
    <div class="rules-grid">
      <section class="rules-panel">
        <h3>开局与回合</h3>
        <ul>
          <li>双方初始生命为 {{ INITIAL_HP }}。{{ characters.length }} 张不同人物牌洗混后，随机分成两个 {{ characters.length / 2 }} 张牌库。</li>
          <li>双方起手均为 {{ INITIAL_HAND_SIZE }} 张。AI 和联机对局都随机先后手；玩家 1 为先手。</li>
          <li>一名玩家从开始行动到结束行动，叫一个回合（turn）；双方各行动一次，叫一轮（round）。第 1 轮包含玩家 1 和玩家 2 各自的首回合。</li>
          <li>双方自己的第一回合都有 {{ INITIAL_MANA }} 点最大行动力，之后每个己方回合 +1，上限 {{ MAX_MANA }}。</li>
          <li>己方回合开始：增加行动力上限并回满，再从牌库抽牌补至 {{ TARGET_HAND_SIZE }} 张，最后处理复出、最高指示等回合开始效果。</li>
          <li>手牌已有 {{ TARGET_HAND_SIZE }} 张或更多时不补牌，超过 {{ TARGET_HAND_SIZE }} 张也不弃牌；技能仍可额外抽牌。牌库抽空就停止补牌，没有疲劳伤害或手牌上限。</li>
          <li>联机模式双方各用自己的浏览器：创建房间并分享 ID，另一人加入后自动开局。双方只看到自己的手牌；AI 模式自动进行对方回合。</li>
        </ul>
      </section>
      <section class="rules-panel">
        <h3>出牌与攻击</h3>
        <ul>
          <li>点击手牌，再点“打出人物”：立即支付费用并登场。每方最多 {{ BOARD_LIMIT }} 人在场，出牌不能撤回。</li>
          <li>需要目标的登场技能，出牌后点击高亮角色完成；不能取消或跳过。有合法目标时，完成选择才能继续操作。</li>
          <li>没有合法目标时照常登场并跳过该技能；抽牌等不需要目标的技能直接结算。</li>
          <li>新登场人物本回合休息，下个己方回合才能攻击；拥有 <strong class="ability-name">「{{ ABILITIES.CHARGE.name }}」</strong> 的人物例外。</li>
          <li>每个人物每回合最多攻击一次。点击己方可攻击人物，再点击敌方人物或“攻击玩家”按钮。</li>
          <li>人物互殴同时造成各自攻击力的伤害，生命 ≤ 0 就离场；攻击玩家时，玩家不反击。</li>
        </ul>
      </section>
      <section class="rules-panel">
        <h3>派别克制</h3>
        <p class="faction-cycle">造反派 → 保守派 → 军队 → 造反派</p>
        <p>对被自己克制的人物造成伤害时，该次伤害 +1，反击也独立计算。加成不永久改变攻击力，攻击玩家时不计算克制。</p>
        <p>无派别不克制其它派别，也不被克制。卡底颜色：保守派浅蓝、造反派浅红、军队浅绿、无派别米色。</p>
      </section>
      <section class="rules-panel">
        <h3>同组加成与稀有度</h3>
        <p>关系组：<template v-for="(name, id, index) in GROUP_NAMES" :key="id"><span v-if="index">、</span><strong class="relation-name">「{{ name }}」</strong></template>。同组只计算己方场上的成员：</p>
        <ul><li>1 人：没有加成。</li><li>2 人：这些成员攻击力 +1。</li><li>3 人或更多：这些成员攻击力 +2，上限 +2。</li></ul>
        <p>成员登场或离场后即时重算，不改变原始数值。R 通常无技能，SR 使用公共技能，SSR 拥有独特机制。</p>
      </section>
    </div>
    <section class="rules-section">
      <h3>公共事件卡池</h3>
      <p>{{ eventCards.length }} 张事件卡单独洗牌，不进入人物牌库。前 {{ EVENT_UNLOCK_TURN - 1 }} 个回合不展示、不能使用事件；从第 {{ Math.ceil(EVENT_UNLOCK_TURN / 2) }} 轮玩家 2 的回合开始，场地右侧同时展示 2 张，双方共用。</p>
      <p>点击事件，再点击“使用事件”，支付行动力。每个玩家每回合最多用 1 张；使用后弃置，原位置立即补下一张。牌池耗尽后空位不补，事件不循环。</p>
      <p>事件的攻击修正“仅持续本回合”，只影响事件结算时已在场的人物，可与技能、关系加成叠加；当前玩家结束回合时清除，不延续到对方回合。敌方减攻在此期间影响反击。全局事件影响双方，己方事件只影响使用者。</p>
      <p>事件伤害不计算派别克制，正常触发 <strong class="ability-name">「{{ ABILITIES.TOUGH.name }}」</strong>、<strong class="ability-name">「{{ ABILITIES.ZHOU_MEDIATION.name }}」</strong> 和死亡、复出、离场爆炸。“生命降至 1”直接设置生命，不算伤害；“直接离场”不能被 <strong class="ability-name">「{{ ABILITIES.TOUGH.name }}」</strong> 或 <strong class="ability-name">「{{ ABILITIES.ZHOU_MEDIATION.name }}」</strong> 阻止。</p>
      <p><strong class="event-name">「{{ eventCards.find(card => card.id === 'september_13_incident')!.name }}」</strong> 使在场林彪直接离场并结算 <strong class="ability-name">「{{ ABILITIES.LIN_COUNTDOWN.name }}」</strong>；林彪不在场时不凭空爆炸，其他集团成员仍减攻。伤害先同时结算，离场及连锁效果完成后，再给存活者加减攻击。</p>
      <div class="rules-grid"><article v-for="card in eventCards" :key="card.id" class="rules-panel"><strong class="event-name">「{{ card.name }}」</strong><span> · {{ card.cost }} 费 · {{ card.scope }}</span><p>{{ card.description }}</p></article></div>
    </section>
    <section class="rules-section">
      <h3>公共技能 · SR</h3>
      <div class="rules-grid">
        <article v-for="id in reusableIds" :key="id" class="rules-panel ability-rule">
          <strong class="ability-name">「{{ ABILITIES[id].name }}」</strong>
          <p>{{ ABILITIES[id].description }}</p>
        </article>
      </div>
      <p><strong class="ability-name">「{{ ABILITIES.TOUGH.name }}」</strong> 在任一玩家的新回合开始时重置，反击也能触发；完全抵消伤害仍消耗次数，原本 0 点伤害不消耗。</p>
      <p>“仅持续本回合”：当前行动玩家结束回合时消失。“直到你的下个回合开始”：从技能生效起，覆盖对方接下来的完整回合，在施放者的下个回合开始时消失，与先后手或轮数无关。</p>
      <p><strong class="ability-name">「{{ ABILITIES.BUFF_ONE.name }}」</strong> 可以选择休息中的己方人物，但不能选择刚登场的自己，增攻仅持续本回合。<strong class="ability-name">「{{ ABILITIES.WEAKEN.name }}」</strong> 减攻持续到施放者的下个回合开始，既影响当前反击，也影响对方下个回合的攻击；施放者离场不会提前终止。各项修正可以叠加，按各自期限消失，最终攻击力最低为 0。</p>
      <p><strong class="ability-name">「{{ ABILITIES.GUARD.name }}」</strong> 不强制对方攻击保卫者，可以攻击任何敌方人物；技能对玩家的伤害不受它阻挡。</p>
      <p><strong class="ability-name">「{{ ABILITIES.REVEAL_HAND.name }}」</strong> 将中间的对方牌背替换为触发时的手牌人名，人名与外框按派别显示蓝／红／绿／米色；选择手牌、选择攻击者或进行下一操作后恢复牌背。手牌较多时可横向滑动查看。</p>
    </section>
    <section class="rules-section">
      <h3>独特技能 · SSR</h3>
      <div class="rules-grid">
        <article v-for="card in uniqueCharacters" :key="card.id" class="rules-panel ability-rule">
          <span class="rules-character">{{ card.name }}</span>
          <strong class="ability-name">「{{ ABILITIES[card.abilityId!].name }}」</strong>
          <p>{{ ABILITIES[card.abilityId!].description }}</p>
        </article>
      </div>
      <p><strong class="ability-name">「{{ ABILITIES.MAO_RANDOM_COMMAND.name }}」</strong> 登场恢复生命不受 20 HP 限制；不在登场时投骰，禁止攻击只影响毛泽东本人。双方张玉凤都免疫骰 6 的伤害，但仍会受到其它来源的伤害。</p>
      <p><strong class="ability-name">「{{ ABILITIES.ZHOU_MEDIATION.name }}」</strong> 在任一玩家的新回合开始时重置，因此对方回合也能救另一名己方人物；不能救自己，也不能阻止直接死亡。周恩来可能因此死亡；同时受到致命伤害时不能救人。</p>
      <p><strong class="ability-name">「{{ ABILITIES.DENG_RETURN.name }}」</strong> 第四次死亡后不再复出；场地满时等待下一己方回合。被救下而没有死亡，不消耗复出次数。<strong class="ability-name">「{{ DENG_RECTIFICATION_NAME }}」</strong> 只加成复出时已在场的其他己方保守派，本回合结束时消失。</p>
      <p><strong class="ability-name">「{{ ABILITIES.LIN_COUNTDOWN.name }}」</strong> 登场回合结束也减计数；归零、战斗或技能造成的死亡都会引发离场爆炸。被救到 1 HP 而未离场时不爆炸，归零死亡不能被救。爆炸可引发连锁死亡。</p>
      <p><strong class="ability-name">「{{ ABILITIES.JIANG_BORROW_POWER.name }}」</strong> 抽取牌库顺序中的第一张造反派，其余牌顺序不变；没有造反派时跳过抽牌。攻击加成随己方毛泽东登场或离场即时变化，可以与同组加成叠加。</p>
    </section>
    <p class="muted">派别、关系组与稀有度是游戏机制分类，不是对历史人物的正式定性或重要性评价。联机需要互联网，断线后需重新开局；当前无存档或组牌功能。</p>
  </section>
</template>

<style scoped>
.game-rules { max-width: 1080px; margin: auto; padding: 28px; border: 1px solid #587367; border-radius: 16px; background: #203b34; }
.game-rules > h2 { font-size: 26px; margin-bottom: 10px; }
.rules-intro { color: #bac6b8; margin-bottom: 24px; }
.rules-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.rules-panel { padding: 18px; border: 1px solid #456153; border-radius: 10px; background: #172f28; }
h3 { margin: 0 0 12px; font-size: 17px; color: #f1d69d; }
p, li { font-size: 14px; line-height: 1.85; }
ul { margin: 0; padding-left: 20px; } li + li { margin-top: 8px; }
.rules-panel p { margin: 10px 0 0; }
.faction-cycle { color: #d5dcb8; font-weight: 700; }
.rules-section { margin-top: 28px; }
.rules-character { display: block; color: #b5c5b5; font-size: 12px; margin-bottom: 6px; }
@media (max-width: 800px) { .rules-grid { grid-template-columns: 1fr; } }
</style>
