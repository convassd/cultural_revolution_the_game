# Architecture

The game engine is pure TypeScript and can run without Vue or a DOM. Vue displays state and sends actions; it does not directly change HP, resources, decks or combat rules.

## Definitions and live instances

`CharacterDefinition` holds original card data from `src/data/characters.json`: `type: "character"`, rarity, faction, cost, base attack, base health, relationship group, ability ID and image path. The type marker leaves room for future categories without introducing inheritance or implementing events/equipment now.

`CharacterInstance` holds live health, attack readiness, temporary attack changes, damage-reduction usage and unique-ability state. Return effects use attack/faction overrides rather than editing original definitions.

`PlayerState` holds HP, resources, deck, hand, battlefield, discard pile, pending returns and Mediation usage for the current global turn. `GameState` holds both players, the current turn, winner, instance ID counter, revealed-hand snapshot, logs and any mandatory entry target awaiting selection. It contains no rollback history.

The engine retains a revealed-hand snapshot until turn end. The UI shows it as names in the opponent's hand strip only for the caster, and dismisses that display on the next selection or game action.

## Engine entry points

```ts
createGame(cards, random)
applyAction(state, action, definitions, random)
```

Both accept an optional random source returning a value in `[0, 1)`, defaulting to `Math.random`. Initialization uses it for shuffling; actions use it for live dice outcomes.

`applyAction` returns `{ state, error, events }`. Successful actions produce a new snapshot. Invalid actions return the original state, an error message and no events. Internal helpers mutate only the engine's fresh copy.

`PLAY_CARD` spends resources and puts the character in play immediately. If an eligible entry target is needed, `SELECT_PLAY_TARGET` completes the effect; other actions are blocked until then. AI callers can supply `PLAY_CARD.targetId` to resolve the play and target together. Neither path supports undo.

## Rules and effects

- `rules.ts`: constants, faction advantage, dynamic relationship and Jiang Qing auras, effective stats and eligible entry targets.
- `combat.ts`: simultaneous damage, using stats before deaths change the battlefield.
- `effects.ts`: damage batches, reduction, death replacement, removals, returns and unique turn triggers. Deaths resolve in waves: remove each lethal batch, then process Lin Biao's departure blast and any resulting deaths. Each departure fires once. Deng's return adds an ordinary temporary attack modifier to other friendly Conservatives; both players' Mediation uses reset at every global turn start.
- `engine.ts`: initialization, shuffling, draws, action validation and turn changes.
- `ai.ts`: legal action enumeration and one-step position scoring.

The AI does not search opponent responses or future turns. Unknown turn-start dice outcomes are averaged without consuming the live random stream. It does not inspect enemy hand contents or future deck order. See the [AI report](../reports/ai-evaluation.md) for methodology and results.

## Presentation

`CharacterCard.vue` owns the shared card-face markup and scoped visual styles. The gallery, hand, battlefield and death fragments all render this component. `style.css` defines one viewport-based card width and proportional 3:4 height, inherited by every view; the gallery grid only arranges fixed-size cards and never stretches them to fill a row. Change the component to replace the card template everywhere, and change the shared dimension variables to adjust its size everywhere.

Damage, death and return events become temporary presentation snapshots. These preserve pre-action positions while a dead card shatters. They use actual damage events, including reduction and replacement effects, rather than inferring damage from HP differences or parsing logs.

Timers live in the UI; animations do not delay rule resolution. The UI temporarily locks further actions while battle effects play, then shows a result banner and plays its tone once when a winner exists. Restart, Back and unmount clean up pending effects, AI timers and audio.

## Multiplayer

`online/protocol.ts` owns `HostMatch`, runtime action validation and per-seat display snapshots. The host alone runs `createGame` and `applyAction`, including all live randomness. The guest sends action requests tagged with a match ID and revision. The host binds requests to the connection's assigned seat and rejects forged seats, invalid actions and stale revisions.

Display snapshots reuse the `GameState` shape for the existing components. Both deck arrays and the opponent hand contain empty-string placeholders preserving counts; they are never passed to the engine. A revealed-hand snapshot is sent only to its caster. Pending entry targets are sent only to the active player. Public boards, discards, return state, logs and battle events are synchronized.

`online/session.ts` manages a single PeerJS data connection, protocol/ruleset handshake, initial game, snapshots, action requests, acknowledgements, heartbeat and cleanup. Each browser acknowledges a snapshot after its presentation completes; the host then releases both interfaces. This prevents overlapping combat animations without putting network or timer logic in the engine. Only the host can rematch after victory. A fresh match ID isolates old messages.

`OnlineLobby.vue` provides create/join/copy-ID UI. `App.vue` keeps a fixed local seat, delegates online actions to the session and renders projected state. AI games never construct a PeerJS peer. Back/unmount destroys peers and timers; disconnects freeze actions and require a new room. The host remains trusted and sees the complete state internally; this is casual P2P play, not a system that prevents host cheating.

See [Multiplayer](MULTIPLAYER.md) for public-service dependencies, connectivity limits and manual verification steps.

Tests cover pure rules, complete seeded matches, AI decisions, presentation snapshots and Vue rendering/events through a small in-memory host. They do not replace manual testing of animation appearance or audio playback in real browsers.
