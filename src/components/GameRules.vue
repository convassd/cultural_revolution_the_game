<script setup lang="ts">
import { characters } from '../data'
import { eventCards } from '../data/events'
import { ABILITIES, DENG_RECTIFICATION_NAME } from '../data/abilities'
import { BOARD_LIMIT, CHARACTERS_PER_EVENT, DEFAULT_RULES, GROUP_NAMES, INITIAL_HAND_SIZE, INITIAL_HP } from '../game/rules'
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
          <li>双方初始生命为 {{ INITIAL_HP }}。{{ characters.length }} 张人物与 {{ eventCards.length }} 张事件分别洗牌、平均分配；每人 {{ characters.length / 2 }} 张人物、{{ eventCards.length / 2 }} 张事件。各自牌库按每 {{ CHARACTERS_PER_EVENT }} 张人物后放 1 张事件均匀穿插。</li>
          <li>双方起手均为 {{ INITIAL_HAND_SIZE }} 张。AI 和联机对局都随机先后手；玩家 1 为先手。</li>
          <li>指定条件的抽牌技能可从牌库中提前取出符合条件的牌，其余牌顺序不变，不会重新调整人物与事件的间隔。</li>
          <li>一名玩家从开始行动到结束行动，叫一个回合（turn）；双方各行动一次，叫一轮（round）。第 1 轮包含玩家 1 和玩家 2 各自的首回合。</li>
          <li>每个己方回合行动力固定重置为 {{ DEFAULT_RULES.energyPerTurn }}（E），不增长、不累积；卖牌可使本回合行动力超过 E。</li>
          <li v-if="DEFAULT_RULES.secondPlayerOpeningBonus">后手仅在自己的首回合额外获得 {{ DEFAULT_RULES.secondPlayerOpeningBonus }} 行动力（合计 {{ DEFAULT_RULES.energyPerTurn + DEFAULT_RULES.secondPlayerOpeningBonus }}）；不额外加牌，未用完也不保留。</li>
          <li>己方回合开始：行动力重置为 E，再固定抽 {{ DEFAULT_RULES.drawPerTurn }}（K）张，最后处理复出、最高指示等效果。双方各自首回合不额外抽牌，起手保持 5 张。</li>
          <li>手牌全部保留，无上限、无强制弃牌；牌库空时跳过抽牌，无疲劳伤害。选中手牌后点击手牌区左侧垃圾桶，或将牌拖入垃圾桶，即可永久移除该牌并获得等于费用的行动力；每回合不限次数，卖牌不能撤回。</li>
          <li>联机模式双方各用自己的浏览器：创建房间并分享 ID，另一人加入后自动开局。双方只看到自己的手牌；AI 模式自动进行对方回合。</li>
        </ul>
      </section>
      <section class="rules-panel">
        <h3>出牌与攻击</h3>
        <ul>
          <li>选中人物手牌后点击己方任一场地位置，或将牌拖入该位置，即可支付费用并登场。点击已有人物的位置也能出牌，不会替换原人物；人物登场后向左排列，每方最多 {{ BOARD_LIMIT }} 人，出牌不能撤回。</li>
          <li>人物技能全部自动结算，打出后无需选择技能目标，可以立即继续出牌、卖牌或结束回合。</li>
          <li>选牌后合法区域会高亮。再次点击同一张手牌，或按 Esc，可取消选择；拖到区域外不会打出或卖出。</li>
          <li>自动选取以当前实际攻击力为准，包含关系、事件和临时修正；并列取最左侧，没有合法目标则照常登场并跳过技能。</li>
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
      <h3>持续事件</h3>
      <p>事件与人物混在各自牌库和手牌中，从开局即可打出，也可卖出。选中事件手牌后点击右侧“当前事件”位置，或将牌拖入其中，即可支付费用并生效；不占人物场地，每回合可打出多张。</p>
      <p>全场仅一张事件生效，对双方一视同仁。新事件替换旧事件，旧事件进入原持有者的弃牌堆。事件不循环，也没有公共抽取卡池。</p>
      <p>“持续”攻击修正一直生效，包括后来登场、复出的人物；派别变化时即时重算。替换事件时旧修正消失，不影响人物技能的独立期限。</p>
      <p>“打出时”的伤害、治疗、抽牌、生命降至 1、直接离场只结算一次，不在每个回合重复；造成的伤害和抽到的牌不会因事件被替换而撤销。一月风暴由双方各自检查是否有四人帮成员，各自抽牌。</p>
      <p>事件伤害正常触发减伤、调解、死亡和复出；生命降至 1 不算伤害，直接离场不受减伤和调解保护。</p>
      <div class="rules-grid"><article v-for="card in eventCards" :key="card.id" class="rules-panel"><strong class="event-name">「{{ card.name }}」</strong><span> · {{ card.cost }} 费</span><p>{{ card.description }}</p></article></div>
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
      <p><strong class="ability-name">「{{ ABILITIES.BUFF_ONE.name }}」</strong> 自动使另一名当前攻击力最高的己方人物攻击 +1，可以作用于休息中的人物，排除张春桥自己；增攻仅持续本回合。<strong class="ability-name">「{{ ABILITIES.WEAKEN.name }}」</strong> 自动使当前攻击力最高的敌方人物攻击 -1，并列取最左侧。减攻持续到施放者的下个回合开始，既影响当前反击，也影响对方下个回合的攻击；施放者离场不会提前终止。各项修正可以叠加，按各自期限消失，最终攻击力最低为 0。</p>
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
