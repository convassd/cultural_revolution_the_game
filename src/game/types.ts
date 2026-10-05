export type PlayerId = 0 | 1
export type Faction = '造反派' | '保守派' | '军队' | '无派别'
export type Rarity = 'R' | 'SR' | 'SSR'
export type RelationGroup = 'gang_of_four' | 'lin_group' | 'wang_guan_qi'
export type AbilityId =
  | 'TOUGH' | 'BUFF_ONE' | 'DRAW_ONE' | 'REVEAL_HAND'
  | 'GROUP_DRAW' | 'CHARGE' | 'WEAKEN' | 'GUARD'
  | 'MAO_RANDOM_COMMAND' | 'ZHOU_MEDIATION' | 'DENG_RETURN'
  | 'LIN_COUNTDOWN' | 'JIANG_BORROW_POWER'

export interface CharacterDefinition {
  type: 'character'
  id: string
  name: string
  rarity: Rarity
  faction: Faction
  cost: number
  attack: number
  health: number
  relationGroup: RelationGroup | null
  abilityId: AbilityId | null
  image: string
}

export interface CharacterInstance {
  instanceId: string
  definitionId: string
  health: number
  canAttack: boolean
  temporaryAttack: number
  toughUsed: boolean
  attackOverride?: number
  factionOverride?: Faction
  returnCount?: number
  countdown?: number
  commandRoll?: number
}

export interface PlayerState {
  id: PlayerId
  hp: number
  mana: number
  maxMana: number
  deck: string[]
  hand: string[]
  board: CharacterInstance[]
  discard: string[]
  pendingReturns: CharacterInstance[]
  mediationUsed: boolean
}

export interface GameState {
  players: [PlayerState, PlayerState]
  currentPlayer: PlayerId
  turn: number
  winner: PlayerId | null
  nextInstanceId: number
  revealedHand: { viewer: PlayerId; owner: PlayerId; cards: string[] } | null
  log: string[]
  pendingPlayTarget: { cardId: string; targetIds: string[] } | null
}

export type GameAction =
  | { type: 'PLAY_CARD'; player: PlayerId; cardId: string; targetId?: string }
  | { type: 'SELECT_PLAY_TARGET'; player: PlayerId; targetId: string }
  | { type: 'ATTACK'; player: PlayerId; attackerId: string;
      target: { type: 'player' } | { type: 'character'; instanceId: string } }
  | { type: 'END_TURN'; player: PlayerId }

export interface ActionResult {
  state: GameState
  error: string | null
  events: GameEvent[]
}

// Per-action facts for presentation. No timers or animation state enter the rules.
export type GameEvent =
  | { type: 'CHARACTER_DAMAGED'; instanceId: string; amount: number }
  | { type: 'PLAYER_DAMAGED'; playerId: PlayerId; amount: number }
  | { type: 'CHARACTER_DIED'; playerId: PlayerId; character: CharacterInstance }
  | { type: 'CHARACTER_RETURNED'; playerId: PlayerId; character: CharacterInstance }
