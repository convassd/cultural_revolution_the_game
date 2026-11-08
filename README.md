# Cultural Revolution: The Game · v0.3.0

A small browser card game set around characters from China's Cultural Revolution. Built with Vue 3, Vite and TypeScript as a personal learning and entertainment project.

**[Click to play it now](https://convassd.github.io/cultural_revolution_the_game/)**

The game interface is in Simplified Chinese; repository documentation is in English. **v0.3.0** introduces fixed resources, selling, persistent events and destination-based card controls. Current defaults are **4 energy and 3 draws per own turn**, with **6 extra energy on the second seat's opening turn only**. Each player receives exactly 24 characters and six events, interleaved four-to-one. See the [v0.3.0 release notes](docs/RELEASE-v0.3.0.md). The [hand-flow evaluation](reports/hand-flow-evaluation.md) explains the retained resource defaults but predates the new interleaved deal; it is not a balance guarantee for this release. Earlier updates are documented in [v0.2.0](docs/RELEASE-v0.2.0.md), [v0.1.1](docs/RELEASE-v0.1.1.md) and [v0.1.0](docs/RELEASE-v0.1.0.md).

## What is included

- 48 unique character cards with individual SVG illustrations.
- 12 global event cards, shuffled separately from characters and divided evenly: each private 30-card deck contains 24 characters and six events in a four-character/one-event sequence. A single shared active event persists until a new event replaces it.
- Two-player PeerJS/WebRTC multiplayer by sharing a room ID, or a local AI 2.0 opponent that plans action sequences and considers limited opponent replies.
- Fixed per-turn energy (E), fixed draws (K), permanent card sales for energy, simultaneous character combat, faction advantages and dynamic relationship bonuses.
- All eight reusable abilities and all five unique character abilities.
- A card gallery with separate character/event sections, character faction filters and rarity, cost, attack and health sorting.
- Floating damage numbers and shattering death effects that continue without blocking the next action, plus locally synthesized turn cues and a central victory/defeat announcement.

The game runs entirely in the browser. There is no self-hosted game server, account system, database, analytics or AI service. AI matches run locally; multiplayer needs internet access to the public PeerJS signaling service and STUN servers, then sends game messages over a direct WebRTC data channel. No TURN relay is configured, so some NAT/firewall combinations cannot connect. Players visiting the hosted version do not need to clone the repository or install anything. This version does not include a PWA or guaranteed offline cache.

## How to play

1. Choose **AI battle** or **online multiplayer** on the home screen. For multiplayer, one player creates a room and shares its ID; the other pastes that ID and joins. Connection starts the match automatically. **Game rules** opens the Chinese rules guide; **Browse cards** opens the complete gallery. Skill names, descriptions and relationship names in the guide are read from the same data as the cards.
2. Characters and events are shuffled separately and split evenly. Each player receives 24 characters and six events, interleaved four characters then one event. Draw five starting cards (four characters and one event) and start with 20 HP. Conditional skill draws can take matching cards out of order without rearranging the remaining deck. Both modes randomly assign seats, with equal chances of going first or second. Your own cards always appear at the bottom.
3. Select a hand character, then click any friendly battlefield slot, or drag the card there. Characters append and align left, including when the clicked slot is occupied. Playing immediately spends its cost and puts it on the battlefield. All character abilities resolve automatically. Support buffs the other friendly character with the highest current attack; Escalation debuffs the highest-attack enemy. Ties use the leftmost battlefield character; with no eligible target, skip the ability. Plays cannot be undone. Select a hand event and click the active-event area, or drag the event there. It replaces the single active event at the right of the battlefield. Ongoing attack auras affect both players and later arrivals; damage, healing and draws happen once on entry. Select any hand card and click the trash slot at the left of the hand, or drag the card there, to remove it permanently and gain energy equal to its cost. Selling does not trigger entry abilities.
4. New characters rest until your next turn unless they have the charge ability. Select a ready character, then an enemy character or the opponent's attack button. Each character attacks at most once per turn.
5. At the start of each player's turn, reset energy to E (currently 4), draw K cards (currently 3), then resolve returns and other turn-start abilities. Each player's first turn skips automatic draws to retain a five-card opening; the second seat gets a one-time +6 energy bonus, for 10 opening energy. Hands have no limit and are retained. Sales can raise energy above E within a turn, but it does not carry over. In multiplayer, each browser keeps its own hand visible and waits for the opponent. AI games advance automatically.
6. Reduce the opponent to 0 HP to win. AI matches can restart at any time. The result banner remains visible until restarting or returning to the menu. After an online match ends, the host can start a rematch with newly randomized seats. Back returns to the home screen and closes the connection; the other player sees a disconnect notice. There is no save or reconnect system.

See [Rules and abilities](docs/RULES.md) for complete mechanics and English descriptions of the Chinese card abilities.

See [Multiplayer setup, testing and troubleshooting](docs/MULTIPLAYER.md) for two-window and two-device tests, connection limits and the host-authoritative design.

On desktop, player information sits beside each battlefield row, with turn information on the left. Gallery, battlefield and hand cards share one card-face template, a fixed 3:4 shape and the same viewport-based dimensions. The compact battlefield stays centered, while a separate hand area spans the browser's available width and fits its contents with minimal padding. A trash slot sits at the left of the hand. The fixed-width right column shows only energy above a tall End Turn button; card actions happen through their destinations rather than extra buttons. Legal destinations highlight when a card is selected. Desktop supports dragging; touch and keyboard users can select a card and activate a destination. Both battlefield rows and your hand fit typical landscape browser viewports. Long hands scroll horizontally; hover over skill text for the complete description and relationship name. The log sits on the right when there is room beside the battlefield and moves below the hand otherwise. Narrow screens retain a vertical layout with swipeable card rows and a non-blocking portrait orientation hint.

## Run locally

Use Node.js 22 and npm. Install dependencies once:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. On Windows PowerShell, use `npm.cmd` in place of `npm` if script execution policy blocks `npm.ps1`.

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

The production website is written to `dist/`. Serve it over HTTP, rather than opening `index.html` through `file://`. The relative Vite base and portrait URL handling support deployment under a repository subdirectory.

## Publish to GitHub Pages

The repository includes a [Pages workflow](.github/workflows/pages.yml). Every push to `main` installs locked dependencies, runs tests, checks types, builds the game and deploys only `dist/`. Pull requests run the same verification without publishing.

For repository setup, authentication, Pages settings and tagged releases, follow the [deployment guide](docs/DEPLOYMENT.md). No custom domain, separate website repository or manually maintained build branch is needed.

## Project structure

```text
.github/workflows/pages.yml  Verification and Pages deployment
docs/                       Rules, architecture, portraits and publishing
public/portraits/            48 independent character SVGs and a fallback
public/events/               Blank event illustration placeholder
src/
  data/                     Card definitions, Chinese ability text, gallery queries
  game/                     Pure TypeScript types, rules, engine, effects and AI
  ai/                       Browser worker, asynchronous requests and cleanup
  online/                   Host authority, private views, protocol and PeerJS lifecycle
  components/               Cards, battlefield, hand, gallery and result banner
  presentation/             Battle snapshots and browser-generated result sounds
  App.vue                   UI selection, action dispatch and turn scheduling
  *.test.ts                 Rule, AI, presentation and component tests
scripts/                    Reproducible AI benchmark tools
reports/                    Reproducible AI and rule-change evaluations
```

See [Architecture](docs/ARCHITECTURE.md), [Portraits and references](docs/PORTRAITS.md) and [AI 2.0 evaluation](reports/ai-v2-evaluation.md). The [earlier greedy AI report](reports/ai-evaluation.md) is retained as historical context.

## Scope and assets

Factions, relationship groups and rarities are abstractions for game mechanics, rather than formal historical classifications or measures of a person's significance.

The illustrations are locally authored SVG artwork. Reference photographs and paintings are linked in the portrait documentation; they are not included as downloaded image assets. No Blizzard artwork, card frames or fonts are bundled. Result sounds are synthesized with the browser's Web Audio API.

This is a playable prototype, with limited balance testing and a desktop-oriented layout. It does not include matchmaking, spectators, reconnects, deep AI search, deck building, collections, saves or equipment. AI and multiplayer use the same rules, including mixed decks, selling, persistent events and the three-countdown Lin Biao. Earlier AI reports describe historical rules; the economy and hand-flow reports record historical tuning experiments; their balance figures predate the interleaved deal.

Local reference books, generated artwork previews, benchmark replay JSON, installed dependencies and build outputs are excluded by `.gitignore`. Keep `package-lock.json` in the repository so installs and CI builds use the same dependency versions.
