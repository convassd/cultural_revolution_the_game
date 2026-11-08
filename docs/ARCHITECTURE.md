# Architecture

The game engine is pure TypeScript and can run without Vue or a DOM. Vue displays state and sends actions; it does not directly change HP, resources, decks or combat rules.

## Definitions and live instances

`CharacterDefinition` holds original card data from `src/data/characters.json`: `type: "character"`, rarity, faction, cost, base attack, base health, relationship group, ability ID and image path. `EventDefinition` holds event IDs, cost, description and image path in `src/data/events.json`. The discriminated `CardDefinition` union includes both without inheritance. Shuffle characters and events separately and divide each evenly, giving each player 24 characters and six events. Interleave four characters followed by one event before taking the opening hand. Conditional draws can extract a matching card without reordering the rest or re-interleaving. Character-only `definitions` serve combat; `cardDefinitions` also includes events for mixed-hand rendering.

`CharacterInstance` holds live health, attack readiness, attack changes, damage-reduction usage and unique-ability state. `temporaryAttack` lasts only through the current turn end. Optional `attackModifiers` entries hold an amount and the global turn at whose start they expire; Escalation uses `state.turn + 2`, so both seats receive the same duration. Turn start expires those entries before draws and character triggers; death/return clears them. Return effects use attack/faction overrides rather than editing original definitions.

`PlayerState` holds HP, resources, deck, hand, battlefield, discard pile, permanently removed sold cards, pending returns and Mediation usage for the current global turn. `GameState` holds both players, the current turn, winner, instance ID counter, revealed-hand snapshot, and logs. Its `rules` snapshot holds E/K, and `activeEvent` holds the current global event and its owner. A replaced event enters the old owner's discard pile. It contains no rollback history.

The engine retains a revealed-hand snapshot until turn end. The UI shows it as names in the opponent's hand strip only for the caster, with faction-colored text and borders using the same faction-class mapping as character cards, and dismisses that display on the next selection or game action.

## Engine entry points

```ts
createGame(characters, random, { energyPerTurn, drawPerTurn })
applyAction(state, action, definitions, random)
```

Both accept an optional random source returning a value in `[0, 1)`, defaulting to `Math.random`. Initialization uses it for shuffling; actions use it for live dice outcomes.

`applyAction` returns `{ state, error, events }`. Successful actions produce a new snapshot. Invalid actions return the original state, an error message and no events. Internal helpers mutate only the engine's fresh copy.

`PLAY_CARD` handles both characters and events. Characters enter the battlefield immediately; events replace the global active event and resolve their one-shot entry effects. `SELL_CARD` removes a hand card into the public `removed` list and gains its printed cost in energy, without entry/death effects. There is no per-turn sell or event-use limit beyond the hand and resources. All character skills resolve automatically in `PLAY_CARD`. Support/Escalation choose the highest effective attack on the eligible side after entry, breaking ties by battlefield order; Support excludes the entering instance. No pending target state, separate target action or play target override exists. Plays cannot be undone.

## Rules and effects

- `rules.ts`: default E/K, faction advantage, dynamic event, relationship and Jiang Qing auras, effective stats and continuous event attack modifiers.
- `combat.ts`: simultaneous damage, using stats before deaths change the battlefield.
- `effects.ts`: damage batches, reduction, death replacement, removals, returns and unique turn triggers. Deaths resolve in waves: remove each lethal batch, then process Lin Biao's departure blast and any resulting deaths. Each departure fires once. Deng's return adds an ordinary temporary attack modifier to other friendly Conservatives; both players' Mediation uses reset at every global turn start.
- `engine.ts`: initialization, shuffling, draws, action validation and turn changes.
- `eventEffects.ts`: one-shot entry effects for the 12 global events, reusing damage batches and departure resolution. Continuous attack modifiers are computed by `effectiveAttack(..., activeEventId)` in rules.ts and never added to temporary character stats. New arrivals and faction changes use the current aura automatically.
- `ai.ts`: legal action enumeration, shared position scoring and the retained one-step greedy/random baselines.
- `aiPlanner.ts`: bounded turn planning, hidden-card sampling and limited opponent-reply search.

AI 2.0 builds a beam of action sequences through the end of its own turn, then evaluates a small beam of the opponent's next-turn responses. It takes the worst reply found in each sampled world and averages the worlds and turn-start dice branches. This is approximate minimax with pruning, not exhaustive search. The shared greedy evaluator ranks intermediate positions and terminal results; the old greedy policy remains available for benchmarks and worker fallback.

Only observations reach the planner: public state, its own hand, card counts and any hand legitimately revealed to it. Actual deck identities/order, the hidden enemy hand and logs are removed before worker requests and before sampling. Two deterministic samples assign remaining unseen cards to unknown hands/decks without consuming live RNG. Hypothetical new own-hand cards cannot be played or sold in a cached plan. An observed draw or other unexpected state change invalidates that continuation and triggers replanning.

Active events, discards and sold cards are public; event cards in hands and decks remain private. Hidden-card sampling uses the unseen portion of the combined 60-card pool and excludes active, sold, discarded and visible cards. Both policies enumerate legal sells and event plays; observed draws invalidate hypothetical continuations.

Default limits are 4,800 engine transitions, an eight-position own beam, 14 own actions, four completed candidates, two hidden-card samples, and a two-position opponent beam capped at ten actions. `src/ai/worker.ts` adds a 650 ms search deadline. `src/ai/client.ts` manages one lazy worker, request IDs, a five-second watchdog and legal greedy fallback if the worker fails. Back, restart and unmount terminate pending searches; the UI also rejects results belonging to an obsolete game snapshot. No backend or external AI service is involved. See the [AI 2.0 report](../reports/ai-v2-evaluation.md) for measured results and limitations.

## Presentation

`CharacterCard.vue` owns the shared card-face markup and scoped visual styles. The gallery, hand, battlefield and death fragments all render this component. `style.css` defines one viewport-based card width and proportional 3:4 height, inherited by every view; the gallery grid only arranges fixed-size cards and never stretches them to fill a row. Change the component to replace the card template everywhere, and change the shared dimension variables to adjust its size everywhere.

`EventCard.vue` provides a distinct document-like event face, shared by the mixed hand, active event and event gallery section, using those same dimension variables. Event names are stored without brackets; the rules page adds yellow corner-quoted references. `ActiveEvent.vue` shows one centered event to the right of the desktop battlefield, separated by a 32px gap and vertical line; narrow layouts place it below the battlefield. Gallery faction filters apply only to characters, while events are displayed separately in cost order.

The hand has a fixed trash slot on the left and a fixed-width column containing only energy and a tall End Turn button on the right. Select a hand card, then click a destination, or use native desktop drag-and-drop. Click the selected hand card again or press Escape to cancel selection. `SellSlot.vue`, `Battlefield.vue` and `ActiveEvent.vue` emit destination gestures; `App.vue` validates card type, owner, capacity, energy and current input permission, then submits the existing `PLAY_CARD` or `SELL_CARD`. The engine, AI and wire actions do not gain positional deployment rules. Native drops must match a drag started in the current hand; external, cancelled or stale drops are ignored. Touch users can use the two-tap path without dragging.

`presentation/cardInteraction.ts` describes UI destinations. Both battlefield rows expose player IDs and individual visible slots 1–5, with a live occupant's instance ID when present. Slot numbers describe hit locations, not persistent character identity: deployment still appends and left-aligns, subject to the existing death-animation reservation. Temporary overflow slots used during death feedback do not introduce a sixth legal target position. These descriptors leave room for future targeted item cards without implementing them now.

Damage, death and return events become independent temporary presentation snapshots. Clickable cards always render the latest committed state. Pointer-transparent overlays show floating numbers and dead-card fragments, so consecutive actions cannot expose stale stats or leave dead cards targetable. `presentation/boardLayout.ts` retains surviving cards' visual positions and reserves death-copy slots until all active deaths on that side finish. It never holds stale game state: live cards still display current stats and can act immediately. Further damage overlays follow these visual positions; a later death starts at the character's displayed position. A new card uses an unreserved slot; if five live cards coexist with a death copy, the row temporarily exposes an extra horizontally scrollable visual slot without changing engine capacity. When the last death expires, the live row compacts, even if damage-only effects remain. Each effect batch has a unique ID and its own expiry timer; a new action neither replaces earlier effects nor lets an older timer clear a newer batch. These use explicit engine events, including reduction, replacement and HP-setting visual losses, rather than parsing logs. Setting HP to one emits its visual loss without invoking damage-rule triggers.

Timers live in the UI; animations do not delay rule resolution or further legal actions. AI scheduling continues independently of animation timers. After the last pending battle effect, the result banner plays its tone once when a winner exists. A short local two-note cue plays once when the opponent hands control to the local player; online games defer it until synchronization unlocks controls. Initial setup, own actions and ended games do not trigger the turn cue. Restart, Back and unmount clean up pending effects, AI timers and the shared audio context.

## Multiplayer

`online/protocol.ts` owns `HostMatch`, runtime action validation and per-seat display snapshots. The host alone runs `createGame` and `applyAction`, including all live randomness. The guest sends action requests tagged with a match ID and revision. The host binds requests to the connection's assigned seat and rejects forged seats, invalid actions and stale revisions.

Display snapshots reuse the `GameState` shape for the existing components. Both deck arrays and the opponent hand contain empty-string placeholders preserving counts; they are never passed to the engine. A revealed-hand snapshot is sent only to its caster. Public boards, discards, return state, logs and battle events are synchronized.

There is no separate event deck or public market during play. Protocol version 10 handles the balanced, interleaved initial deal, mixed hands, sales, the global active event, automatic character entry skills and the second-seat opening energy bonus. Legacy manual-target actions and play target overrides are rejected. Its ruleset fingerprint includes event definitions, default economy rules, the interleave ratio and combat constants. Each match carries its own rules snapshot. Older clients cannot join a match with incompatible rules.

`online/session.ts` manages a single PeerJS data connection, protocol/ruleset handshake, initial game, snapshots, action requests, acknowledgements, heartbeat and cleanup. Each browser acknowledges a snapshot as soon as it accepts the state; the host releases both interfaces after these acknowledgements. Presentation may still be playing. This retains revision-based synchronization without making either player wait for animation timers. Only the host can rematch after victory. A fresh match ID isolates old messages.

`OnlineLobby.vue` provides create/join/copy-ID UI. `App.vue` keeps a fixed local seat, delegates online actions to the session and renders projected state. AI games never construct a PeerJS peer. Back/unmount destroys peers and timers; disconnects freeze actions and require a new room. The host remains trusted and sees the complete state internally; this is casual P2P play, not a system that prevents host cheating.

See [Multiplayer](MULTIPLAYER.md) for public-service dependencies, connectivity limits and manual verification steps.

Tests cover pure rules, complete seeded matches, AI decisions, presentation snapshots and Vue rendering/events through a small in-memory host. They do not replace manual testing of animation appearance or audio playback in real browsers.
