import { definitions } from '../data'
import { TurnPlanner } from '../game/aiPlanner'
import type { GameState } from '../game/types'

const planner = new TurnPlanner()
self.onmessage = (event: MessageEvent<{ id: number; state: GameState }>) => {
  const { id, state } = event.data
  try {
    const result = planner.next(state, definitions, { timeMs: 650 })
    self.postMessage({ id, ...result })
  } catch {
    self.postMessage({ id, error: 'AI search failed' })
  }
}
