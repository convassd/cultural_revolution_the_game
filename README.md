# Cultural Revolution: The Game · v0.2.0

A small browser card game set around characters from China's Cultural Revolution. Built with Vue 3, Vite and TypeScript as a personal learning and entertainment project.

**[Click to play it now](https://convassd.github.io/cultural_revolution_the_game/)**

The game interface is in Simplified Chinese; repository documentation is in English. See the [v0.2.0 release notes](docs/RELEASE-v0.2.0.md) for shared events, AI 2.0, five-card refill and battle feedback improvements. Earlier updates are documented in [v0.1.1](docs/RELEASE-v0.1.1.md) and [v0.1.0](docs/RELEASE-v0.1.0.md).

## What is included

- 48 unique character cards with individual SVG illustrations.
- 12 single-use event cards in a shared, shuffled pool with two face-up slots, available from player 2's turn in round 4 (individual turn 8). Each player can use one per turn, paying action points.
- Two-player PeerJS/WebRTC multiplayer by sharing a room ID, or a local AI 2.0 opponent that plans action sequences and considers limited opponent replies.
- Turn-based resource spending, simultaneous character combat, faction advantages and dynamic relationship bonuses.
- All eight reusable abilities and all five unique character abilities.
- A card gallery with separate character/event sections, character faction filters and rarity, cost, attack and health sorting.
- Floating damage numbers and shattering death effects that continue without blocking the next action, plus locally synthesized turn cues and a central victory/defeat announcement.

The game runs entirely in the browser. There is no self-hosted game server, account system, database, analytics or AI service. AI matches run locally; multiplayer needs internet access to the public PeerJS signaling service and STUN servers, then sends game messages over a direct WebRTC data channel. No TURN relay is configured, so some NAT/firewall combinations cannot connect. Players visiting the hosted version do not need to clone the repository or install anything. This version does not include a PWA or guaranteed offline cache.

## How to play

1. Choose **AI battle** or **online multiplayer** on the home screen. For multiplayer, one player creates a room and shares its ID; the other pastes that ID and joins. Connection starts the match automatically. **Game rules** opens the Chinese rules guide; **Browse cards** opens the complete gallery. Skill names, descriptions and relationship names in the guide are read from the same data as the cards.
2. Each player receives a shuffled 24-card deck, draws five starting cards and starts with 20 HP. Both modes randomly assign seats, with equal chances of going first or second. Your own cards always appear at the bottom.
3. Select a hand card, then click **Play character**. Playing immediately spends its cost and puts it on the battlefield. For an entry ability requiring a target, click a highlighted character to finish the effect. Plays cannot be undone; mandatory target selection cannot be canceled. If there is no eligible target, the ability is skipped. Select a public event at the right of the battlefield, then click **Use event** in the same controls to pay its cost and resolve it. The used card is discarded and its slot immediately refills; the pool never reshuffles.
4. New characters rest until your next turn unless they have the charge ability. Select a ready character, then an enemy character or the opponent's attack button. Each character attacks at most once per turn.
5. At the start of each player's turn, increase/refill resources, draw until their hand reaches five, then resolve returns and other turn-start abilities. Five is a refill target: excess cards are kept, skills can draw extra, and a hand already at five or more skips the automatic draw. In multiplayer, each browser keeps its own hand visible and waits for the opponent. AI games advance automatically.
6. Reduce the opponent to 0 HP to win. AI matches can restart at any time. After an online match ends, the host can start a rematch with newly randomized seats. Back returns to the home screen and closes the connection; the other player sees a disconnect notice. There is no save or reconnect system.

See [Rules and abilities](docs/RULES.md) for complete mechanics and English descriptions of the Chinese card abilities.

See [Multiplayer setup, testing and troubleshooting](docs/MULTIPLAYER.md) for two-window and two-device tests, connection limits and the host-authoritative design.

On desktop, player information sits beside each battlefield row, with turn information on the left. Gallery, battlefield and hand cards share one card-face template, a fixed 3:4 shape and the same viewport-based dimensions. The compact battlefield stays centered, while a separate hand area spans the browser's available width and fits its contents with minimal padding. A narrow control column aligns its top and bottom with the hand cards, placing the selected card's cost and current resources above Play character, with End Turn at the bottom. Both battlefield rows and your hand fit typical landscape browser viewports. Long hands scroll horizontally; hover over skill text for the complete description and relationship name. The log sits on the right when there is room beside the battlefield and moves below the hand otherwise. Narrow screens retain a vertical layout with swipeable card rows and a non-blocking portrait orientation hint.

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

This is a playable prototype, with limited balance testing and a desktop-oriented layout. It does not include matchmaking, spectators, reconnects, deep AI search, deck building, collections, saves or equipment. AI and multiplayer use the same rules, including all 12 events and the three-countdown Lin Biao described in the rules guide. The AI reports predate these event cards; their historical win rates are not claims about the current balance.

Local reference books, generated artwork previews, benchmark replay JSON, installed dependencies and build outputs are excluded by `.gitignore`. Keep `package-lock.json` in the repository so installs and CI builds use the same dependency versions.
