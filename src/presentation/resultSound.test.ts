import { afterEach, describe, expect, it, vi } from 'vitest'
import { playResultSound, playTurnSound, prepareResultAudio, stopResultAudio } from './resultSound'

function fakeOscillator() {
  return { type: '', frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  state = 'running'
  currentTime = 10
  destination = {}
  resume = vi.fn(() => Promise.resolve())
  close = vi.fn(() => { this.state = 'closed'; return Promise.resolve() })
  oscillators: Array<ReturnType<typeof fakeOscillator>> = []
  constructor() { FakeAudioContext.instances.push(this) }
  createOscillator() {
    const oscillator = fakeOscillator()
    this.oscillators.push(oscillator)
    return oscillator
  }
  createGain() { return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() } }
}

afterEach(() => { stopResultAudio(); vi.unstubAllGlobals(); FakeAudioContext.instances = [] })

describe('locally synthesized turn and result tones', () => {
  it('plays a short two-note turn cue in the already unlocked context and disconnects finished notes', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    prepareResultAudio()
    const context = FakeAudioContext.instances[0]!
    playTurnSound()
    expect(FakeAudioContext.instances).toHaveLength(1)
    expect(context.resume).toHaveBeenCalledOnce()
    expect(context.oscillators.map(o => o.frequency.value)).toEqual([659.25, 880])
    expect(context.oscillators[0]!.start).toHaveBeenCalledWith(10)
    expect(context.oscillators[1]!.stop.mock.calls[0]![0]).toBeCloseTo(10.22)
    for (const oscillator of context.oscillators) { oscillator.onended!(); expect(oscillator.disconnect).toHaveBeenCalledOnce() }
    stopResultAudio()
    expect(context.close).toHaveBeenCalledOnce()
    playTurnSound()
    expect(context.oscillators).toHaveLength(2)
  })
  it('keeps both result melodies and remains silent when browser audio is suspended', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    prepareResultAudio()
    const context = FakeAudioContext.instances[0]!
    context.state = 'suspended'
    playTurnSound()
    expect(context.oscillators).toEqual([])
    context.state = 'running'
    playResultSound(true)
    playResultSound(false)
    expect(context.oscillators.map(o => o.frequency.value)).toEqual([523.25, 659.25, 783.99, 1046.5, 392, 329.63, 293.66, 196])
  })
  it('does not require AudioContext support to play the game', () => {
    vi.stubGlobal('AudioContext', undefined)
    expect(() => { prepareResultAudio(); playTurnSound(); playResultSound(true); stopResultAudio() }).not.toThrow()
  })
})
