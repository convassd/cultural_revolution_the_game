import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, nextTick } from 'vue'
import App from './App.vue'
import { characters, definitions } from './data'
import { ABILITIES } from './data/abilities'
import * as engine from './game/engine'
import * as ai from './game/ai'
import { createCharacter } from './game/effects'
import { GROUP_NAMES } from './game/rules'
import { BATTLE_EFFECT_DURATION } from './presentation/battle'
import * as resultAudio from './presentation/resultSound'
import type { SessionCallbacks } from './online/session'
import { projectState } from './online/protocol'
import type { GameState, PlayerId, GameEvent } from './game/types'
const onlineMocks = vi.hoisted(() => ({ sessions: [] as Array<{ callbacks: SessionCallbacks; submit: ReturnType<typeof vi.fn>; ready: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; rematch: ReturnType<typeof vi.fn> }> }))
vi.mock('./online/session', async importOriginal => {
  const original = await importOriginal<typeof import('./online/session')>()
  return { ...original, OnlineSession: class {
    submit = vi.fn()
    ready = vi.fn()
    destroy = vi.fn()
    rematch = vi.fn()
    constructor(public callbacks: SessionCallbacks) { onlineMocks.sessions.push(this) }
    host() { this.callbacks.onStatus({ ...original.idleStatus(), phase: 'waiting', id: 'test-room', isHost: true, message: '等待朋友加入' }) }
    join() { this.callbacks.onStatus({ ...original.idleStatus(), phase: 'connecting', message: '正在与房主建立直连' }) }
  } }
})

// Vue's actual render/update/events run against a small in-memory host, without DOM dependencies.
interface Node {
  tag: string
  text: string
  props: Record<string, unknown>
  children: Node[]
  parent: Node | null
}
const node = (tag: string, text = ''): Node => ({ tag, text, props: {}, children: [], parent: null })
function remove(child: Node) {
  if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1)
  child.parent = null
}
function insert(child: Node, parent: Node, anchor: Node | null = null) {
  remove(child)
  const index = anchor ? parent.children.indexOf(anchor) : -1
  parent.children.splice(index < 0 ? parent.children.length : index, 0, child)
  child.parent = parent
}
const renderer = createRenderer<Node, Node>({
  createElement: tag => node(tag), createText: text => node('#text', text), createComment: text => node('#comment', text),
  insert, remove,
  setText: (item, text) => { item.text = text },
  setElementText: (item, text) => { item.text = text; item.children = [] },
  parentNode: item => item.parent,
  nextSibling: item => item.parent?.children[item.parent.children.indexOf(item) + 1] ?? null,
  patchProp: (item, key, _before, value) => { item.props[key] = value },
  insertStaticContent: (content, parent, anchor) => {
    const item = node('#static', content.replace(/<[^>]*>/g, ''))
    insert(item, parent, anchor)
    return [item, item]
  },
})
function text(item: Node): string {
  return (item.tag === '#comment' ? '' : item.text) + item.children.map(text).join('')
}
function descendants(item: Node): Node[] { return [item, ...item.children.flatMap(descendants)] }
const apps: Array<ReturnType<typeof renderer.createApp>> = []
function mount() {
  const root = node('root')
  const app = renderer.createApp(App)
  app.mount(root)
  apps.push(app)
  function button(label: string) {
    const found = descendants(root).find(item => item.tag === 'button' && text(item).startsWith(label))
    expect(found, `button: ${label}`).toBeDefined()
    return found!
  }
  async function click(label: string) {
    const item = button(label)
    expect(item.props.disabled).not.toBe(true)
    ;(item.props.onClick as () => void)()
    await nextTick()
  }
  return { root, app, button, click }
}
beforeEach(() => {
  onlineMocks.sessions.length = 0
  vi.useFakeTimers()
  vi.spyOn(resultAudio, 'prepareResultAudio').mockImplementation(() => {})
  vi.spyOn(resultAudio, 'playResultSound').mockImplementation(() => {})
  vi.spyOn(resultAudio, 'stopResultAudio').mockImplementation(() => {})
  vi.spyOn(Math, 'random').mockReturnValue(0.999999)
  // Scheduling tests isolate UI timing; tactical decisions are covered in game/ai.test.ts.
  vi.spyOn(ai, 'chooseGreedyAction').mockImplementation(state =>
    state.winner === null ? { type: 'END_TURN', player: state.currentPlayer } : null)
})
afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('match mode UI and AI scheduling', () => {
  it.each([['ai', 0], ['ai', 1]] as const)(
    'reveals enemy names in the middle row until the next hand selection: %s seat=%s', async (mode, player) => {
      const state = engine.createGame(characters, () => 0.5)
      state.currentPlayer = player
      state.players[player].mana = 4
      state.players[player].hand = ['kang_sheng', 'wu_han']
      state.players[player === 0 ? 1 : 0].hand = ['mao_zedong', 'lin_biao']
      vi.spyOn(engine, 'createGame').mockReturnValueOnce(state)
      const ui = mount()
      vi.mocked(Math.random).mockReturnValueOnce(player === 0 ? 0.999999 : 0)
      await ui.click('AI对战')
      await ui.click('4康生')
      await ui.click('打出人物')
      const names = () => descendants(ui.root).filter(item => item.props.class === 'revealed-card-name').map(text)
      expect(names()).toEqual(['毛泽东', '林彪'])
      const strip = descendants(ui.root).find(item => item.props.class === 'opponent-hand-cards')!
      expect(strip.props.role).toBe('status')
      expect(text(strip)).not.toContain('◆')
      expect(descendants(ui.root).some(item => item.props.class === 'revealed-hand')).toBe(false)
      await ui.click('2吴晗')
      expect(names()).toEqual([])
      expect(descendants(ui.root).filter(item => item.props.class === 'card-back')).toHaveLength(2)
    })

  it('reveals an empty enemy hand and resets the strip on ending the turn', async () => {
    const state = engine.createGame(characters, () => 0.5)
    state.players[0].mana = 4
    state.players[0].hand = ['kang_sheng']
    state.players[1].hand = []
    vi.spyOn(engine, 'createGame').mockReturnValueOnce(state)
    const ui = mount()
    await ui.click('AI对战')
    await ui.click('4康生')
    await ui.click('打出人物')
    expect(descendants(ui.root).filter(item => item.props.class === 'revealed-card-name').map(text)).toEqual(['无手牌'])
    await ui.click('结束回合')
    expect(descendants(ui.root).some(item => item.props.class === 'revealed-card-name')).toBe(false)
    expect(text(ui.root)).toContain('贪心 AI 正在行动')
  })

  it('does not show an AI hand reveal to the human observer', async () => {
    const state = engine.createGame(characters, () => 0.5)
    state.currentPlayer = 1
    state.players[1].mana = 4
    state.players[1].hand = ['kang_sheng']
    state.players[0].hand = ['mao_zedong', 'lin_biao']
    vi.spyOn(engine, 'createGame').mockReturnValueOnce(state)
    vi.mocked(ai.chooseGreedyAction).mockReturnValueOnce({ type: 'PLAY_CARD', player: 1, cardId: 'kang_sheng' })
    const ui = mount()
    await ui.click('AI对战')
    await vi.advanceTimersByTimeAsync(450)
    expect(descendants(ui.root).some(item => item.props.class === 'revealed-card-name')).toBe(false)
    expect(text(ui.root)).toContain('康生')
  })

  it('opens rules beside the gallery and references current ability and relationship names', async () => {
    const originals = Object.values(ABILITIES).map(ability => ({ ability, name: ability.name, description: ability.description }))
    const originalGroups = { ...GROUP_NAMES }
    try {
      for (const id of Object.keys(GROUP_NAMES) as Array<keyof typeof GROUP_NAMES>) GROUP_NAMES[id] = `测试关系${id}`
      for (const [id, ability] of Object.entries(ABILITIES)) {
        ability.name = `测试名称${id}`
        ability.description = `测试描述${id}`
      }
      const ui = mount()
      expect(text(ui.root)).toContain('横扫一切牛鬼蛇神')
      const menu = descendants(ui.root).find(item => item.props.class === 'welcome-actions')!
      expect(menu.children.filter(item => item.tag === 'button').map(text)).toEqual(['游戏规则', '了解卡牌'])
      await ui.click('游戏规则')
      const names = descendants(ui.root).filter(item => item.props.class === 'ability-name').map(text)
      for (const ability of Object.values(ABILITIES)) {
        expect(names).toContain(`「${ability.name}」`)
        expect(text(ui.root)).toContain(ability.description)
      }
      const groupNames = descendants(ui.root).filter(item => item.props.class === 'relation-name').map(text)
      expect(groupNames).toEqual(Object.values(GROUP_NAMES).map(name => `「${name}」`))
      expect(text(ui.root)).toContain('开局与回合')
      expect(vi.getTimerCount()).toBe(0)
      await ui.click('返回')
      await ui.click('AI对战')
      expect(text(ui.root)).not.toContain('桌面规则')
      expect(descendants(ui.root).some(item => item.props['aria-label'] === '游戏规则')).toBe(false)
      expect(text(ui.root)).toContain('对局记录')
      await ui.click('返回')
      expect(text(ui.root)).toContain('横扫一切牛鬼蛇神')
    } finally {
      Object.assign(GROUP_NAMES, originalGroups)
      for (const { ability, name, description } of originals) Object.assign(ability, { name, description })
    }
  })

  it.each([
    ['ai', 0, 0, '全面胜利'], ['ai', 0, 1, '退出舞台'],
    ['ai', 1, 0, '退出舞台'], ['ai', 1, 1, '全面胜利'],
  ] as const)('shows the result once after damage: %s human=%s winner=%s', async (mode, human, winner, label) => {
    const state = engine.createGame(characters, () => 0.5)
    state.currentPlayer = winner
    state.players[winner === 0 ? 1 : 0].hp = 1
    const attacker = createCharacter(definitions.nie_yuanzi!, 'finisher')
    attacker.canAttack = true
    state.players[winner].board = [attacker]
    vi.spyOn(engine, 'createGame').mockReturnValueOnce(state)
    const ui = mount()
    vi.mocked(Math.random).mockReturnValueOnce(human === 0 ? 0.999999 : 0)
    vi.mocked(ai.chooseGreedyAction).mockReturnValueOnce({ type: 'ATTACK', player: winner,
      attackerId: 'finisher', target: { type: 'player' } })
    await ui.click('AI对战')
    expect(resultAudio.prepareResultAudio).toHaveBeenCalledOnce()
    if (mode === 'ai' && winner !== human) await vi.advanceTimersByTimeAsync(450)
    else {
      const card = descendants(ui.root).find(item => item.tag === 'button' &&
        String(item.props['aria-label']).startsWith('聂元梓，'))!
      ;(card.props.onClick as () => void)()
      await nextTick()
      await ui.click('攻击贪心 AI')
    }
    expect(descendants(ui.root).some(item => String(item.props.class).includes('match-result'))).toBe(false)
    expect(resultAudio.playResultSound).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(BATTLE_EFFECT_DURATION)
    const overlay = descendants(ui.root).find(item => String(item.props.class).includes('match-result'))!
    expect(text(overlay)).toContain(label)
    expect(resultAudio.playResultSound).toHaveBeenCalledExactlyOnceWith(winner === human)
    await vi.advanceTimersByTimeAsync(5000)
    expect(resultAudio.playResultSound).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    await ui.click('重新开始')
    expect(descendants(ui.root).some(item => String(item.props.class).includes('match-result'))).toBe(false)
    expect(resultAudio.stopResultAudio).toHaveBeenCalledTimes(2)
    await ui.click('返回')
    expect(resultAudio.stopResultAudio).toHaveBeenCalledTimes(3)
  })

  it('shows Jiang drawing a rebel and stacking Mao and group auras without the removed full-group victory', async () => {
    const state = engine.createGame(characters, () => 0.5)
    state.players[0].mana = 4
    state.players[0].hand = ['jiang_qing']
    state.players[0].board = ['zhang_chunqiao', 'yao_wenyuan', 'wang_hongwen', 'mao_zedong'].map(id => createCharacter(definitions[id]!, id))
    state.players[0].deck = ['wu_han', 'nie_yuanzi']
    state.players[1].hp = 6
    vi.spyOn(engine, 'createGame').mockReturnValueOnce(state)
    const ui = mount()
    await ui.click('AI对战')
    const card = descendants(ui.root).find(item => item.tag === 'button' &&
      String(item.props['aria-label']).startsWith('江青，'))!
    ;(card.props.onClick as () => void)()
    await nextTick()
    await ui.click('打出人物')
    expect(resultAudio.playResultSound).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(BATTLE_EFFECT_DURATION)
    expect(descendants(ui.root).find(item => item.props['aria-label'] === '江青，费用 4，攻击 7，生命 5')).toBeDefined()
    expect(text(ui.root)).toContain('借势')
    expect(text(ui.root)).toContain('聂元梓')
    expect(text(ui.root)).not.toContain('全面胜利')
    expect(text(ui.root)).not.toContain('请将操作交给')
    expect(resultAudio.playResultSound).not.toHaveBeenCalled()
  })

  it.each([
    ['zhang_chunqiao', '张春桥', '吴晗'], ['yao_wenyuan', '姚文元', '林立果'],
  ])('commits %s on play and then requires a target without cancel or undo controls', async (cardId, name, targetName) => {
    const state = engine.createGame(characters, () => 0.5)
    state.players[0].hand = [cardId!, 'wu_de']
    state.players[0].mana = 10
    state.players[0].board = [createCharacter(definitions.wu_han!, 'friendly')]
    state.players[1].board = [createCharacter(definitions.lin_liguo!, 'enemy')]
    vi.spyOn(engine, 'createGame').mockReturnValueOnce(state)
    const actions = vi.spyOn(engine, 'applyAction')
    const ui = mount()
    async function clickCard(cardName: string) {
      const card = descendants(ui.root).find(item => item.tag === 'button' &&
        String(item.props['aria-label']).startsWith(`${cardName}，`))!
      expect(card).toBeDefined()
      expect(card.props.disabled).not.toBe(true)
      ;(card.props.onClick as () => void)()
      await nextTick()
    }
    await ui.click('AI对战')
    await clickCard(name!)
    await ui.click('打出人物')
    const committed = actions.mock.results.at(-1)!.value.state
    expect(committed.players[0].hand).toEqual(['wu_de'])
    expect(committed.players[0].mana).toBe(10 - definitions[cardId!]!.cost)
    expect(committed.players[0].board.at(-1).definitionId).toBe(cardId)
    expect(text(ui.root)).toContain('人物已登场并支付费用')
    expect(text(ui.root)).not.toContain('取消选目标')
    expect(text(ui.root)).not.toContain('撤回')
    expect(ui.button('结束回合').props.disabled).toBe(true)
    const remainingHand = descendants(ui.root).find(item => item.tag === 'button' &&
      String(item.props['aria-label']).startsWith('吴德，'))!
    expect(remainingHand.props.disabled).toBe(true)
    await clickCard(targetName!)
    expect(actions.mock.lastCall?.[1].type).toBe('SELECT_PLAY_TARGET')
    expect(actions.mock.results.at(-1)!.value.state.pendingPlayTarget).toBeNull()
    expect(ui.button('结束回合').props.disabled).toBe(false)
    expect(text(ui.root)).not.toContain('人物已登场并支付费用')
  })

  it('offers equal mode buttons with their own descriptions and a separate gallery button', () => {
    const ui = mount()
    expect(ui.button('双人联机').props.class).toBe('mode-button')
    expect(ui.button('AI对战').props.class).toBe('mode-button')
    expect(text(ui.button('双人联机'))).toContain('分享 ID')
    expect(text(ui.button('AI对战'))).toContain('单步评估')
    expect(ui.button('了解卡牌').props.class).not.toBe('mode-button')
  })

  it('opens the online lobby, creates a room and disposes the connection on return', async () => {
    const ui = mount()
    expect(text(ui.root)).not.toContain('双人对战')
    await ui.click('双人联机')
    expect(text(ui.root)).toContain('加入朋友')
    expect(onlineMocks.sessions).toHaveLength(0)
    await ui.click('创建房间')
    expect(text(ui.root)).toContain('等待朋友加入')
    const session = onlineMocks.sessions[0]!
    expect(descendants(ui.root).find(item => item.props.id === 'share-room-id')?.props.value).toBe('test-room')
    await ui.click('返回')
    expect(session.destroy).toHaveBeenCalledOnce()
    session.callbacks.onStatus({ phase: 'closed', id: '', isHost: true, seat: 0, ready: false, message: 'late failure' })
    await nextTick()
    expect(text(ui.root)).not.toContain('late failure')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('joins using an ID, sends only actions, and displays a private reveal snapshot until the next selection', async () => {
    const ui = mount()
    await ui.click('双人联机')
    const input = descendants(ui.root).find(item => item.props.id === 'room-id')!
    ;(input.props.onInput as Function)({ target: { value: 'test-room' } })
    await nextTick()
    expect(ui.button('加入房间').props.disabled).toBe(false)
    const form = descendants(ui.root).find(item => item.tag === 'form')!
    ;(form.props.onSubmit as Function)({ preventDefault() {} })
    await nextTick()
    const session = onlineMocks.sessions[0]!
    const state = engine.createGame(characters, () => 0.5)
    state.currentPlayer = 1
    state.players[1].mana = 10
    state.players[1].hand = ['kang_sheng', 'wu_han']
    state.players[0].hand = ['mao_zedong', 'lin_biao']
    const frame = (state: GameState, revision: number, reveal = false) => ({ matchId: 'room-match', revision, seat: 1 as PlayerId, state: projectState(state, 1), events: [], reveal })
    const status = { phase: 'playing' as const, id: 'guest-id', isHost: false, seat: 1 as PlayerId, ready: true, message: '已连接' }
    session.callbacks.onStatus(status)
    session.callbacks.onFrame(frame(state, 0))
    await nextTick()
    expect(text(ui.root)).toContain('你（玩家 2） 的手牌')
    expect(text(ui.root)).not.toContain('毛泽东')
    expect(text(ui.root)).not.toContain('请将操作交给')
    const apply = vi.spyOn(engine, 'applyAction')
    await ui.click('4康生')
    await ui.click('打出人物')
    expect(session.submit).toHaveBeenCalledWith({ type: 'PLAY_CARD', player: 1, cardId: 'kang_sheng' })
    expect(apply).not.toHaveBeenCalled()
    session.callbacks.onStatus({ ...status, ready: false })
    await nextTick()
    expect(ui.button('结束回合').props.disabled).toBe(true)
    const after = structuredClone(state)
    after.players[1].hand = ['wu_han']
    after.players[1].board = [createCharacter(definitions.kang_sheng!, 'kang')]
    after.players[1].mana = 6
    after.revealedHand = { viewer: 1, owner: 0, cards: ['mao_zedong', 'lin_biao'] }
    session.callbacks.onFrame(frame(after, 1, true))
    session.callbacks.onStatus(status)
    await nextTick()
    expect(descendants(ui.root).filter(item => item.props.class === 'revealed-card-name').map(text)).toEqual(['毛泽东', '林彪'])
    expect(session.ready).toHaveBeenCalledTimes(2)
    await ui.click('2吴晗')
    expect(descendants(ui.root).filter(item => item.props.class === 'card-back')).toHaveLength(2)
    expect(text(ui.root)).not.toContain('毛泽东')
    ui.app.unmount()
    apps.splice(apps.indexOf(ui.app), 1)
    expect(session.destroy).toHaveBeenCalledOnce()
  })

  it('keeps the online perspective through remote damage, acknowledges after animation, and freezes on disconnect', async () => {
    const ui = mount()
    await ui.click('双人联机')
    await ui.click('创建房间')
    const session = onlineMocks.sessions[0]!
    const state = engine.createGame(characters, () => 0.5)
    state.players[1].hp = 1
    state.players[0].board = [createCharacter(definitions.nie_yuanzi!, 'remote-attacker')]
    const status = { phase: 'playing' as const, id: 'host-id', isHost: true, seat: 1 as PlayerId, ready: true, message: '已连接' }
    const frame = (state: GameState, revision: number, events: GameEvent[] = []) => ({ matchId: 'online-match', revision, seat: 1 as PlayerId, state: projectState(state, 1), events, reveal: false })
    session.callbacks.onStatus(status)
    session.callbacks.onFrame(frame(state, 0))
    await nextTick()
    expect(ui.button('结束回合').props.disabled).toBe(true)
    expect(text(ui.root)).toContain('等待对方行动')
    const result = engine.applyAction(state, { type: 'ATTACK', player: 0, attackerId: 'remote-attacker', target: { type: 'player' } }, definitions)
    session.callbacks.onStatus({ ...status, ready: false })
    session.callbacks.onFrame(frame(result.state, 1, result.events))
    await nextTick()
    expect(text(ui.root)).toContain('正在显示伤害与离场效果')
    expect(session.ready).toHaveBeenCalledOnce()
    expect(resultAudio.playResultSound).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(BATTLE_EFFECT_DURATION)
    expect(session.ready).toHaveBeenCalledTimes(2)
    expect(text(ui.root)).toContain('退出舞台')
    expect(resultAudio.playResultSound).toHaveBeenCalledExactlyOnceWith(false)
    session.callbacks.onStatus({ ...status, phase: 'closed', ready: false, message: '对方已离开' })
    await nextTick()
    expect(text(ui.root)).toContain('对方已离开')
    expect(ui.button('结束回合').props.disabled).toBe(true)
    expect(ui.button('再来一局').props.disabled).toBe(true)
    await ui.click('返回')
    expect(session.destroy).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('locks human actions during AI turn, keeps the human perspective, then returns automatically', async () => {
    const ui = mount()
    await ui.click('AI对战')
    await ui.click('结束回合')
    expect(text(ui.root)).toContain('贪心 AI 正在行动')
    expect(text(ui.root)).toContain('你（玩家 1） 的手牌')
    expect(text(ui.root)).not.toContain('请将操作交给')
    expect(ui.button('结束回合').props.disabled).toBe(true)
    // Even a directly dispatched disabled event cannot advance the opponent's turn.
    ;(ui.button('结束回合').props.onClick as () => void)()
    await nextTick()
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(450)
    expect(ui.button('结束回合').props.disabled).toBe(false)
    expect(text(ui.root)).toContain('第 3 回合')
    expect(text(ui.root)).not.toContain('请将操作交给')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('automatically opens when AI goes first and keeps the second-seat human hand visible', async () => {
    const ui = mount()
    vi.mocked(Math.random).mockReturnValueOnce(0)
    await ui.click('AI对战')
    expect(text(ui.root)).toContain('本局 AI 先手')
    expect(text(ui.root)).toContain('你（玩家 2） 的手牌')
    expect(text(ui.root)).not.toContain('贪心 AI（玩家 1） 的手牌')
    const handCards = () => descendants(ui.root).filter(item => item.tag === 'button' &&
      String(item.props.class).includes('character-card') && item.parent?.props.class === 'hand')
    // The second seat starts with four cards, before its first turn draws one.
    expect(handCards()).toHaveLength(4)
    expect(ui.button('结束回合').props.disabled).toBe(true)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(450)
    expect(text(ui.root)).toContain('第 2 回合 · 你（玩家 2）')
    expect(text(ui.root)).not.toContain('请将操作交给')
    expect(handCards()).toHaveLength(5)
    expect(ui.button('结束回合').props.disabled).toBe(false)
    await ui.click('结束回合')
    await vi.advanceTimersByTimeAsync(450)
    expect(text(ui.root)).toContain('第 4 回合 · 你（玩家 2）')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rerolls seats on restart and cancels the opening AI timer on exit', async () => {
    const ui = mount()
    await ui.click('AI对战')
    expect(text(ui.root)).toContain('本局你先手')
    vi.mocked(Math.random).mockReturnValueOnce(0)
    await ui.click('重新开始')
    expect(text(ui.root)).toContain('本局 AI 先手')
    expect(vi.getTimerCount()).toBe(1)
    await ui.click('返回')
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(text(ui.root)).toContain('一张桌面，两种对战。')
  })

  it('applies opening AI damage to the second-seat human and labels the winner correctly', async () => {
    const state = engine.createGame(characters, () => 0.5)
    state.players[1].hp = 1
    const attacker = createCharacter(definitions.nie_yuanzi!, 'opening-ai-attacker')
    attacker.canAttack = true
    state.players[0].board = [attacker]
    vi.spyOn(engine, 'createGame').mockReturnValueOnce(state)
    vi.mocked(ai.chooseGreedyAction).mockReturnValueOnce({ type: 'ATTACK', player: 0,
      attackerId: attacker.instanceId, target: { type: 'player' } })
    const ui = mount()
    vi.mocked(Math.random).mockReturnValueOnce(0)
    await ui.click('AI对战')
    await vi.advanceTimersByTimeAsync(450)
    expect(text(ui.root)).toContain('贪心 AI（玩家 1） 获胜')
    expect(text(ui.root)).toContain('你（玩家 2） 的手牌')
    await vi.advanceTimersByTimeAsync(BATTLE_EFFECT_DURATION)
    expect(ui.button('结束回合').props.disabled).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels pending AI on exit and cannot affect a subsequently opened online lobby', async () => {
    const ui = mount()
    await ui.click('AI对战')
    await ui.click('结束回合')
    await ui.click('返回')
    expect(vi.getTimerCount()).toBe(0)
    await ui.click('双人联机')
    await vi.advanceTimersByTimeAsync(5000)
    expect(text(ui.root)).toContain('加入朋友')
    expect(text(ui.root)).not.toContain('贪心 AI（玩家 2）')
  })

  it('restart preserves AI mode and cancels the old turn; unmount also cancels timers', async () => {
    const ui = mount()
    await ui.click('AI对战')
    await ui.click('结束回合')
    await ui.click('重新开始')
    expect(text(ui.root)).toContain('玩家 vs 贪心 AI')
    expect(ui.button('结束回合').props.disabled).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    await ui.click('结束回合')
    ui.app.unmount()
    apps.splice(apps.indexOf(ui.app), 1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('continues after an AI play without exposing its hand', async () => {
    const state = engine.createGame(characters, () => 0.5)
    state.players[1].hand = ['wu_han']
    state.players[1].deck = []
    vi.spyOn(engine, 'createGame').mockReturnValueOnce(state)
    vi.spyOn(ai, 'chooseGreedyAction')
      .mockReturnValueOnce({ type: 'PLAY_CARD', player: 1, cardId: 'wu_han' })
      .mockReturnValueOnce({ type: 'END_TURN', player: 1 })
    const ui = mount()
    await ui.click('AI对战')
    await ui.click('结束回合')
    await vi.advanceTimersByTimeAsync(450)
    expect(text(ui.root)).toContain('贪心 AI 正在行动')
    expect(text(ui.root)).not.toContain('贪心 AI（玩家 2） 的手牌')
    expect(ui.button('结束回合').props.disabled).toBe(true)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(450)
    expect(ui.button('结束回合').props.disabled).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('waits for end-turn death effects before scheduling the first AI action', async () => {
    const state = engine.createGame(characters, () => 0.5)
    const lin = createCharacter(definitions.lin_biao!, 'lin')
    lin.countdown = 1
    state.players[0].board = [lin]
    state.players[1].board = [createCharacter(definitions.wu_han!, 'enemy')]
    vi.spyOn(engine, 'createGame').mockReturnValueOnce(state)
    const ui = mount()
    await ui.click('AI对战')
    await ui.click('结束回合')
    expect(text(ui.root)).toContain('战斗结算中')
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(BATTLE_EFFECT_DURATION - 1)
    expect(text(ui.root)).toContain('战斗结算中')
    await vi.advanceTimersByTimeAsync(1)
    expect(text(ui.root)).toContain('贪心 AI 正在行动')
    expect(ui.button('结束回合').props.disabled).toBe(true)
    await vi.advanceTimersByTimeAsync(450)
    expect(ui.button('结束回合').props.disabled).toBe(false)
  })

  it('stops after the AI wins and finishes showing damage', async () => {
    const state = engine.createGame(characters, () => 0.5)
    state.players[0].hp = 1
    state.players[1].hand = []
    state.players[1].deck = []
    state.players[1].board = [createCharacter(definitions.nie_yuanzi!, 'ai-attacker')]
    vi.spyOn(engine, 'createGame').mockReturnValueOnce(state)
    const ui = mount()
    await ui.click('AI对战')
    await ui.click('结束回合')
    vi.mocked(ai.chooseGreedyAction).mockReturnValueOnce({ type: 'ATTACK', player: 1,
      attackerId: 'ai-attacker', target: { type: 'player' } })
    await vi.advanceTimersByTimeAsync(450)
    expect(text(ui.root)).toContain('贪心 AI（玩家 2） 获胜')
    await vi.advanceTimersByTimeAsync(BATTLE_EFFECT_DURATION)
    expect(vi.getTimerCount()).toBe(0)
    expect(ui.button('结束回合').props.disabled).toBe(true)
  })
})
