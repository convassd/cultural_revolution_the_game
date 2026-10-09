import { definitions } from '../data'
import { chooseGreedyAction } from '../game/ai'
import { observeForAi } from '../game/aiPlanner'
import type { GameAction, GameState } from '../game/types'

export class AiClient {
  private worker: Worker | null = null
  private sequence = 0
  private pending: { id: number; finish: (action: GameAction | null) => void; fallback: () => void } | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private closed = false

  choose(state: GameState): Promise<GameAction | null> {
    if (this.closed) return Promise.resolve(null)
    this.pending?.finish(null)
    clearTimeout(this.timer)
    const id = ++this.sequence
    return new Promise(resolve => {
      const finish = (action: GameAction | null) => {
        if (this.pending?.id !== id) return
        clearTimeout(this.timer)
        this.pending = null
        resolve(action)
      }
      const fallback = () => {
        this.worker?.terminate()
        this.worker = null
        // Worker unavailability must not leave the game stuck.
        finish(chooseGreedyAction(state, definitions))
      }
      this.pending = { id, finish, fallback }
      try {
        if (!this.worker) {
          this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
          this.worker.onmessage = event => {
            const pending = this.pending
            if (!pending || event.data.id !== pending.id) return
            if (event.data.error) pending.fallback()
            else pending.finish(event.data.action)
          }
          this.worker.onerror = () => this.pending?.fallback()
          this.worker.onmessageerror = () => this.pending?.fallback()
        }
        this.timer = setTimeout(fallback, 5000)
        this.worker.postMessage({ id, state: observeForAi(state) })
      } catch { fallback() }
    })
  }
  destroy() {
    this.closed = true
    this.pending?.finish(null)
    clearTimeout(this.timer)
    this.worker?.terminate()
    this.worker = null
  }
}
