# Architecture

The game engine is pure TypeScript and can run without Vue or a DOM. Vue displays state and sends actions; it does not directly change HP, resources, decks or combat rules.

## Definitions and live instances

`CharacterDefinition` holds original card data from `src/data/characters.json`: `type: "character"`, rarity, faction, cost, base attack, base health, relationship group, ability ID and image path. The type marker leaves room for future categories without introducing inheritance or implementing events/equipment now.

`CharacterInstance` holds live health, attack readiness, temporary attack changes, damage-reduction usage and unique-ability state. Return effects use attack/faction overrides rather than editing original definitions.

`PlayerState` holds HP, resources, deck, hand, battlefield, discard pile and pending returns. `GameState` holds both players, the current turn, winner, instance ID counter, revealed-hand snapshot, once-per-game group trigger, logs and any mandatory entry target awaiting selection. It contains no rollback history.

## Engine entry points

```ts
createGame(cards, random)
applyAction(state, action, definitions, random)
```

Both accept an optional random source returning a value in `[0, 1)`, defaulting to `Math.random`. Initialization uses it for shuffling; actions use it for live dice outcomes.

`applyAction` returns `{ state, error, events }`. Successful actions produce a new snapshot. Invalid actions return the original state, an error message and no events. Internal helpers mutate only the engine's fresh copy.

`PLAY_CARD` spends resources and puts the character in play immediately. If an eligible entry target is needed, `SELECT_PLAY_TARGET` completes the effect; other actions are blocked until then. AI callers can supply `PLAY_CARD.targetId` to resolve the play and target together. Neither path supports undo.

## Rules and effects

- `rules.ts`: constants, faction advantage, dynamic relationship aura, effective stats and eligible entry targets.
- `combat.ts`: simultaneous damage, using stats before deaths change the battlefield.
- `effects.ts`: damage batches, reduction, death replacement, removals, returns and unique turn triggers.
- `engine.ts`: initialization, shuffling, draws, action validation and turn changes.
- `ai.ts`: legal action enumeration and one-step position scoring.

The AI does not search opponent responses or future turns. Unknown turn-start dice outcomes are averaged without consuming the live random stream. It does not inspect enemy hand contents or future deck order. See the [AI report](../reports/ai-evaluation.md) for methodology and results.

## Presentation

Damage, death and return events become temporary presentation snapshots. These preserve pre-action positions while a dead card shatters. They use actual damage events, including reduction and replacement effects, rather than inferring damage from HP differences or parsing logs.

Timers live in the UI; animations do not delay rule resolution. The UI temporarily locks further actions while battle effects play, then shows a result banner and plays its tone once when a winner exists. Restart, Exit and unmount clean up pending effects, AI timers and audio.

Tests cover pure rules, complete seeded matches, AI decisions, presentation snapshots and Vue rendering/events through a small in-memory host. They do not replace manual testing of animation appearance or audio playback in real browsers.
