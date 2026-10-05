import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Peer } from 'peerjs'
import { characters } from '../data'
import * as engine from '../game/engine'
import { definitions } from '../data'
import { legalTurnActions } from '../game/ai'
import { OnlineSession, type OnlineStatus } from './session'
import { PROTOCOL, RULESET, type OnlineFrame } from './protocol'

// Paired event-driven endpoints preserve message order and serialize payloads like a data channel.
class Emitter {
  listeners = new Map<string, Array<(...args: any[]) => void>>()
  on(event: string, callback: (...args: any[]) => void) {
    this.listeners.set(event, [...this.listeners.get(event) ?? [], callback]); return this
  }
  emit(event: string, ...args: unknown[]) { for (const fn of this.listeners.get(event) ?? []) fn(...args) }
}
class Link extends Emitter {
  open = false
  other!: Link
  metadata = { protocol: PROTOCOL }
  sent: unknown[] = []
  send(value: unknown) {
    this.sent.push(structuredClone(value))
    queueMicrotask(() => { if (this.open && this.other.open) this.other.emit('data', structuredClone(value)) })
  }
  close() {
    if (!this.open) return
    this.open = this.other.open = false
    this.emit('close'); this.other.emit('close')
  }
}
const peers = new Map<string, Endpoint>()
class Endpoint extends Emitter {
  id = `test-peer-${peers.size + 1}`
  links: Link[] = []
  constructor() { super(); peers.set(this.id, this); queueMicrotask(() => this.emit('open', this.id)) }
  connect(id: string) {
    const local = new Link(), remote = new Link()
    local.other = remote; remote.other = local; this.links.push(local)
    queueMicrotask(() => {
      const target = peers.get(id)
      if (!target) { this.emit('error', { type: 'peer-unavailable' }); return }
      target.links.push(remote); target.emit('connection', remote)
      local.open = remote.open = true
      local.emit('open'); remote.emit('open')
    })
    return local
  }
  destroy() { peers.delete(this.id); this.links.forEach(link => link.close()) }
}
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve() }
const sessions: OnlineSession[] = []
function player(autoReady = true) {
  let status!: OnlineStatus
  const frames: OnlineFrame[] = []
  const errors: string[] = []
  const session = new OnlineSession({
    onStatus: next => { status = next },
    onFrame: frame => { frames.push(frame); if (autoReady) session.ready() },
    onError: error => errors.push(error),
  }, () => new Endpoint() as unknown as Peer)
  sessions.push(session)
  return { session, frames, errors, get status() { return status }, get frame() { return frames.at(-1)! } }
}
async function pair(hostReady = true, guestReady = true) {
  const host = player(hostReady), guest = player(guestReady)
  host.session.host(); await flush()
  guest.session.join(host.status.id); await flush()
  return { host, guest }
}
beforeEach(() => { vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0.4) })
afterEach(() => { sessions.splice(0).forEach(session => session.destroy()); peers.clear(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('online connection lifecycle and synchronization', () => {
  it('handshakes, hides opponent IDs, and resolves both players through one host engine', async () => {
    const { host, guest } = await pair()
    expect(host.status.isHost).toBe(true)
    expect(guest.status.isHost).toBe(false)
    expect(host.status.ready && guest.status.ready).toBe(true)
    expect(host.frame.seat).toBe(0)
    expect(guest.frame.seat).toBe(1)
    expect(guest.frame.state.players[0].hand.every(id => id === '')).toBe(true)
    const apply = vi.spyOn(engine, 'applyAction')
    host.session.submit({ type: 'END_TURN', player: 0 }); await flush()
    expect(guest.frame.state.turn).toBe(2)
    guest.session.submit({ type: 'END_TURN', player: 1 }); await flush()
    expect(host.frame.state.turn).toBe(3)
    expect(host.frame.state.players.map(p => p.hp)).toEqual(guest.frame.state.players.map(p => p.hp))
    expect(apply).toHaveBeenCalledTimes(2)
    expect(host.frame.revision).toBe(guest.frame.revision)
    expect(host.status.ready && guest.status.ready).toBe(true)
  })
  it('waits for both presentation acknowledgements before accepting any action', async () => {
    const { host, guest } = await pair(false, false)
    expect(host.status.ready || guest.status.ready).toBe(false)
    host.session.submit({ type: 'END_TURN', player: 0 }); await flush()
    expect(host.frame.state.turn).toBe(1)
    host.session.ready(); await flush()
    expect(host.status.ready).toBe(false)
    guest.session.ready(); await flush()
    expect(host.status.ready && guest.status.ready).toBe(true)
    host.session.submit({ type: 'END_TURN', player: 0 }); await flush()
    expect(host.status.ready || guest.status.ready).toBe(false)
  })
  it('rejects a guest forging the host seat and recovers after a rejected action', async () => {
    const { host, guest } = await pair()
    guest.session.submit({ type: 'END_TURN', player: 0 }); await flush()
    expect(guest.errors.at(-1)).toContain('无效')
    expect(host.frame.state.turn).toBe(1)
    expect(guest.status.ready).toBe(true)
    host.session.submit({ type: 'END_TURN', player: 0 }); await flush()
    guest.session.submit({ type: 'PLAY_CARD', player: 1, cardId: 'not-a-card' }); await flush()
    expect(guest.errors.at(-1)).toContain('不在你的手牌')
    expect(guest.status.ready).toBe(true)
  })
  it('ignores a duplicate request with the old revision', async () => {
    const { host, guest } = await pair()
    host.session.submit({ type: 'END_TURN', player: 0 }); await flush()
    const link = peers.get(guest.status.id)!.links[0]!
    guest.session.submit({ type: 'END_TURN', player: 1 }); await flush()
    const oldAction = link.sent.find((value: any) => value.type === 'action')
    link.send(oldAction); await flush()
    expect(host.frame.state.turn).toBe(3)
    expect(host.frame.revision).toBe(2)
  })
  it('stops both sides on departure and cleans timers on exit', async () => {
    const { host, guest } = await pair()
    guest.session.destroy(); await flush()
    expect(host.status.phase).toBe('closed')
    expect(host.status.ready).toBe(false)
    const frames = host.frames.length
    host.session.submit({ type: 'END_TURN', player: 0 })
    expect(host.frames).toHaveLength(frames)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('times out lost data channels even if no close event arrives', async () => {
    const { host, guest } = await pair()
    const link = peers.get(guest.status.id)!.links[0]!
    link.send = () => {}
    link.other.send = () => {}
    await vi.advanceTimersByTimeAsync(35000)
    expect(host.status.phase).toBe('closed')
    expect(guest.status.phase).toBe('closed')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('handles missing IDs and signaling timeout with actionable status', async () => {
    const invalid = player()
    invalid.session.join('')
    expect(invalid.errors.at(-1)).toContain('有效')
    expect(peers.size).toBe(0)
    const absent = player()
    absent.session.join('missing-peer'); await flush()
    expect(absent.status.phase).toBe('closed')
    expect(absent.status.message).toContain('不存在')
    const slow = new OnlineSession({ onStatus: () => {}, onFrame: () => {}, onError: () => {} }, () => new Emitter() as unknown as Peer)
    sessions.push(slow); slow.host()
    // Minimal stalled test endpoint still supports resource cleanup.
    ;(slow as any).peer.destroy = () => {}
    await vi.advanceTimersByTimeAsync(30000)
    expect(slow.status.phase).toBe('closed')
  })
  it('rejects incompatible rules before sending any private game state', async () => {
    const host = player()
    host.session.host(); await flush()
    const peer = new Endpoint()
    const link = peer.connect(host.status.id)
    link.on('open', () => link.send({ type: 'hello', protocol: PROTOCOL, ruleset: RULESET + 'old' }))
    await flush()
    expect(host.status.phase).toBe('closed')
    expect(host.status.message).toContain('版本不同')
    expect(host.frames).toHaveLength(0)
    peer.destroy()
  })
  it('prevents mid-game restart and allows only the host to rematch after victory', async () => {
    const initial = engine.createGame(characters, () => 0.4)
    initial.winner = 0
    vi.spyOn(engine, 'createGame').mockReturnValueOnce(initial)
    const { host, guest } = await pair()
    const id = host.frame.matchId
    guest.session.rematch(); await flush()
    expect(host.frame.matchId).toBe(id)
    host.session.rematch(); await flush()
    expect(host.frame.matchId).not.toBe(id)
    expect(guest.frame.matchId).toBe(host.frame.matchId)
    expect(guest.frame.state.winner).toBeNull()
    const newId = host.frame.matchId
    host.session.rematch(); await flush()
    expect(host.frame.matchId).toBe(newId)
  })
  it.each([7, 29, 83])('completes a serialized two-peer battle using only each acting player view (seed %s)', async seed => {
    let value = seed
    vi.mocked(Math.random).mockImplementation(() => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296 })
    const { host, guest } = await pair()
    let actions = 0
    while (host.frame.state.winner === null && actions < 1500) {
      expect(host.status.ready && guest.status.ready).toBe(true)
      const actor = host.frame.state.currentPlayer === host.frame.seat ? host : guest
      const legal = legalTurnActions(actor.frame.state, definitions)
      const action = legal.find(a => a.type === 'SELECT_PLAY_TARGET') ??
        legal.find(a => a.type === 'ATTACK' && a.target.type === 'player') ??
        legal.find(a => a.type === 'ATTACK') ??
        legal.filter(a => a.type === 'PLAY_CARD').sort((a, b) => definitions[b.cardId]!.cost - definitions[a.cardId]!.cost)[0] ??
        legal.find(a => a.type === 'END_TURN')!
      // Exercise the human UI's separate entry-target step rather than supplying targets inline.
      if (action.type === 'PLAY_CARD') delete action.targetId
      actor.session.submit(action); await flush(); actions++
      expect(host.frame.revision).toBe(guest.frame.revision)
      expect(host.frame.state.players.map(p => p.board)).toEqual(guest.frame.state.players.map(p => p.board))
      expect(host.frame.state.players.map(p => p.hp)).toEqual(guest.frame.state.players.map(p => p.hp))
      expect(host.frame.state.log).toEqual(guest.frame.state.log)
      expect(host.errors).toEqual([]); expect(guest.errors).toEqual([])
    }
    expect(actions).toBeLessThan(1500)
    expect(host.frame.state.winner).not.toBeNull()
    expect(host.frame.state.winner).toBe(guest.frame.state.winner)
  })
  it('does not expose another match to an additional guest', async () => {
    const { host, guest } = await pair()
    const extra = player()
    extra.session.join(host.status.id); await flush()
    expect(extra.frames).toHaveLength(0)
    expect(host.status.ready && guest.status.ready).toBe(true)
    host.session.submit({ type: 'END_TURN', player: 0 }); await flush()
    expect(guest.frame.state.turn).toBe(2)
  })
})
