import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { characters, definitions } from '../data'
import { createGame } from '../game/engine'
import { legalTurnActions } from '../game/ai'
import { AiClient } from './client'

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() { FakeWorker.instances.push(this) }
  reply(data: unknown) { this.onmessage?.({ data }) }
}
beforeEach(() => { vi.useFakeTimers(); FakeWorker.instances = []; vi.stubGlobal('Worker', FakeWorker) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
describe('AI worker lifecycle', () => {
  it('sends only a private observation and reuses the worker for subsequent actions', async () => {
    const state = createGame(characters, () => .5)
    const client = new AiClient()
    const first = client.choose(state)
    const worker = FakeWorker.instances[0]!
    const request = worker.postMessage.mock.calls[0]![0]
    expect(request.state.players[0].hand).toEqual(state.players[0].hand)
    expect(request.state.players[1].hand).toEqual(Array(5).fill(''))
    expect(request.state.players.every((p: { deck: string[] }) => p.deck.every(id => id === ''))).toBe(true)
    expect(request.state.eventPool.deck).toEqual(Array(12).fill(''))
    const action = { type: 'END_TURN', player: 0 }
    worker.reply({ id: request.id, action })
    expect(await first).toEqual(action)
    const second = client.choose(state)
    expect(FakeWorker.instances).toHaveLength(1)
    worker.reply({ id: worker.postMessage.mock.calls[1]![0].id, action })
    expect(await second).toEqual(action)
    client.destroy()
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('settles canceled requests and ignores stale replies after restart or exit', async () => {
    const state = createGame(characters, () => .5)
    const client = new AiClient()
    const first = client.choose(state)
    const worker = FakeWorker.instances[0]!
    const firstId = worker.postMessage.mock.calls[0]![0].id
    const second = client.choose(state)
    expect(await first).toBeNull()
    worker.reply({ id: firstId, action: { type: 'END_TURN', player: 0 } })
    client.destroy()
    expect(await second).toBeNull()
    expect(await client.choose(state)).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })
  it.each(['error', 'timeout', 'unavailable'])('falls back legally on worker %s', async reason => {
    const state = createGame(characters, () => .5)
    if (reason === 'unavailable') vi.stubGlobal('Worker', undefined)
    const client = new AiClient()
    const choice = client.choose(state)
    if (reason === 'error') FakeWorker.instances[0]!.onerror?.()
    if (reason === 'timeout') await vi.advanceTimersByTimeAsync(5000)
    expect(legalTurnActions(state, definitions)).toContainEqual(await choice)
    expect(vi.getTimerCount()).toBe(0)
    client.destroy()
  })
})
