# Architecture

The game engine is pure TypeScript and can run without Vue or a DOM. Vue displays state and sends actions; it does not directly change HP, resources, decks or combat rules.

## Definitions and live instances

`CharacterDefinition` holds original card data from `src/data/characters.json`: `type: "character"`, rarity, faction, cost, base attack, base health, relationship group, ability ID and image path. `EventDefinition` holds event IDs, cost, scope, description and image path in `src/data/events.json`. The discriminated `CardDefinition` union includes both without inheritance; character decks and shared event pools remain separate.

`CharacterInstance` holds live health, attack readiness, attack changes, damage-reduction usage and unique-ability state. `temporaryAttack` lasts only through the current turn end. Optional `attackModifiers` entries hold an amount and the global turn at whose start they expire; Big-Character Poster uses `state.turn + 2`, so both seats receive the same duration. Turn start expires those entries before draws and character triggers; death/return clears them. Return effects use attack/faction overrides rather than editing original definitions.

`PlayerState` holds HP, resources, deck, hand, battlefield, discard pile, pending returns and Mediation usage for the current global turn. `GameState` holds both players, the current turn, winner, instance ID counter, revealed-hand snapshot, logs and any mandatory entry target awaiting selection. Its `eventPool` holds the shuffled event deck, two public slots, public discard and a per-turn usage flag. It contains no rollback history.

The engine retains a revealed-hand snapshot until turn end. The UI shows it as names in the opponent's hand strip only for the caster, with faction-colored text and borders using the same faction-class mapping as character cards, and dismisses that display on the next selection or game action.

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
- `eventEffects.ts`: the 12 event effects, reusing damage batches and departure resolution. `USE_EVENT` validates the public slot, turn limit and mana before resolution; events do not enter character hands or battlefield slots.
- `ai.ts`: legal action enumeration, shared position scoring and the retained one-step greedy/random baselines.
- `aiPlanner.ts`: bounded turn planning, hidden-card sampling and limited opponent-reply search.

AI 2.0 builds a beam of action sequences through the end of its own turn, then evaluates a small beam of the opponent's next-turn responses. It takes the worst reply found in each sampled world and averages the worlds and turn-start dice branches. This is approximate minimax with pruning, not exhaustive search. The shared greedy evaluator ranks intermediate positions and terminal results; the old greedy policy remains available for benchmarks and worker fallback.

Only observations reach the planner: public state, its own hand, card counts and any hand legitimately revealed to it. Actual deck identities/order, the hidden enemy hand and logs are removed before worker requests and before sampling. Two deterministic samples assign remaining unseen cards to unknown hands/decks without consuming live RNG. Hypothetical new own-hand cards cannot be played in a cached plan. An observed draw or other unexpected state change invalidates that continuation and triggers replanning.

Event slots and discards are public; the remaining event order is redacted and sampled independently from the unseen event definitions. Both AI policies enumerate legal `USE_EVENT` actions. Actual slot replacement invalidates a cached continuation when it differs from the sampled future.

Default limits are 4,800 engine transitions, an eight-position own beam, 14 own actions, four completed candidates, two hidden-card samples, and a two-position opponent beam capped at ten actions. `src/ai/worker.ts` adds a 650 ms search deadline. `src/ai/client.ts` manages one lazy worker, request IDs, a five-second watchdog and legal greedy fallback if the worker fails. Back, restart and unmount terminate pending searches; the UI also rejects results belonging to an obsolete game snapshot. No backend or external AI service is involved. See the [AI 2.0 report](../reports/ai-v2-evaluation.md) for measured results and limitations.

## Presentation

`CharacterCard.vue` owns the shared card-face markup and scoped visual styles. The gallery, hand, battlefield and death fragments all render this component. `style.css` defines one viewport-based card width and proportional 3:4 height, inherited by every view; the gallery grid only arranges fixed-size cards and never stretches them to fill a row. Change the component to replace the card template everywhere, and change the shared dimension variables to adjust its size everywhere.

`EventCard.vue` provides a distinct document-like event face, shared by the public market and event gallery section, using those same dimension variables. Event names are stored without brackets; the rules page adds yellow corner-quoted references. Two vertically aligned event slots sit to the right of the desktop battlefield, separated by a 32px gap and vertical line; narrow layouts place them together below the battlefield. Gallery faction filters apply only to characters, while events are displayed separately in cost order. Event selection uses the existing narrow action controls rather than taking space from the hand.

Damage, death and return events become independent temporary presentation snapshots. Clickable cards always render the latest committed state. Pointer-transparent overlays show floating numbers and dead-card fragments, so consecutive actions cannot expose stale stats or leave dead cards targetable. `presentation/boardLayout.ts` retains surviving cards' visual positions and reserves death-copy slots until all active deaths on that side finish. It never holds stale game state: live cards still display current stats and can act immediately. Further damage overlays follow these visual positions; a later death starts at the character's displayed position. A new card uses an unreserved slot; if five live cards coexist with a death copy, the row temporarily exposes an extra horizontally scrollable visual slot without changing engine capacity. When the last death expires, the live row compacts, even if damage-only effects remain. Each effect batch has a unique ID and its own expiry timer; a new action neither replaces earlier effects nor lets an older timer clear a newer batch. These use explicit engine events, including reduction, replacement and HP-setting visual losses, rather than parsing logs. Setting HP to one emits its visual loss without invoking damage-rule triggers.

Timers live in the UI; animations do not delay rule resolution or further legal actions. AI scheduling continues independently of animation timers. After the last pending battle effect, the result banner plays its tone once when a winner exists. A short local two-note cue plays once when the opponent hands control to the local player; online games defer it until synchronization unlocks controls. Initial setup, own actions and ended games do not trigger the turn cue. Restart, Back and unmount clean up pending effects, AI timers and the shared audio context.

## Multiplayer

`online/protocol.ts` owns `HostMatch`, runtime action validation and per-seat display snapshots. The host alone runs `createGame` and `applyAction`, including all live randomness. The guest sends action requests tagged with a match ID and revision. The host binds requests to the connection's assigned seat and rejects forged seats, invalid actions and stale revisions.

Display snapshots reuse the `GameState` shape for the existing components. Both deck arrays and the opponent hand contain empty-string placeholders preserving counts; they are never passed to the engine. A revealed-hand snapshot is sent only to its caster. Pending entry targets are sent only to the active player. Public boards, discards, return state, logs and battle events are synchronized.

The remaining public-event deck also contains count-only placeholders, while face-up slots, event discard and usage are shared identically with both seats. Protocol version 6 includes the longer attack-modifier state and turn-relative expiry behavior; its ruleset fingerprint includes event definitions, Lin's initial countdown and `EVENT_UNLOCK_TURN` (8). The engine, legal AI actions and UI share that constant. Older clients cannot join a match with incompatible rules.

`online/session.ts` manages a single PeerJS data connection, protocol/ruleset handshake, initial game, snapshots, action requests, acknowledgements, heartbeat and cleanup. Each browser acknowledges a snapshot as soon as it accepts the state; the host releases both interfaces after these acknowledgements. Presentation may still be playing. This retains revision-based synchronization without making either player wait for animation timers. Only the host can rematch after victory. A fresh match ID isolates old messages.

`OnlineLobby.vue` provides create/join/copy-ID UI. `App.vue` keeps a fixed local seat, delegates online actions to the session and renders projected state. AI games never construct a PeerJS peer. Back/unmount destroys peers and timers; disconnects freeze actions and require a new room. The host remains trusted and sees the complete state internally; this is casual P2P play, not a system that prevents host cheating.

See [Multiplayer](MULTIPLAYER.md) for public-service dependencies, connectivity limits and manual verification steps.

Tests cover pure rules, complete seeded matches, AI decisions, presentation snapshots and Vue rendering/events through a small in-memory host. They do not replace manual testing of animation appearance or audio playback in real browsers.
