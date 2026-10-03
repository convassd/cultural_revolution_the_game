# Wen Ge Sha · v0.0

A small browser card game set around characters from China's Cultural Revolution. Built with Vue 3, Vite and TypeScript as a personal learning and entertainment project.

**[Click to play it now](https://convassd.github.io/cultural_revolution_the_game/)**

The link becomes available after the first successful GitHub Pages deployment. The game interface is in Simplified Chinese; repository documentation is in English.

## What is included

- 48 unique character cards with individual SVG illustrations.
- Two-player hot-seat play in one browser, or a local, one-step greedy AI opponent.
- Turn-based resource spending, simultaneous character combat, faction advantages and dynamic relationship bonuses.
- All eight reusable abilities and all five unique character abilities.
- A card gallery with faction filters and rarity, cost, attack and health sorting.
- Floating damage numbers, shattering death effects, and a central victory/defeat announcement with locally synthesized sound.

The game runs entirely in the browser. It has no backend, accounts, database, analytics or runtime calls to an AI service. Players visiting the hosted version do not need to clone the repository or install anything. Loading the hosted files initially requires an internet connection; this version does not include a PWA or guaranteed offline cache.

## How to play

1. Choose **AI battle** or **two-player battle** on the home screen. **Browse cards** opens the complete gallery.
2. Each player receives a shuffled 24-card deck and starts with 20 HP. In AI games, your seat is randomly assigned, with equal chances of going first or second.
3. Select a hand card, then click **Play character**. Playing immediately spends its cost and puts it on the battlefield. For an entry ability requiring a target, click a highlighted character to finish the effect. Plays cannot be undone; mandatory target selection cannot be canceled. If there is no eligible target, the ability is skipped.
4. New characters rest until your next turn unless they have the charge ability. Select a ready character, then an enemy character or the opponent's attack button. Each character attacks at most once per turn.
5. End your turn to refill resources and draw on the next player's turn. Hot-seat games hide the incoming player's hand until they confirm they are ready; AI games advance automatically.
6. Reduce the opponent to 0 HP to win. Restart begins a fresh game in the same mode; Exit returns to the home screen. There is no save system.

See [Rules and abilities](docs/RULES.md) for complete mechanics and English descriptions of the Chinese card abilities.

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

For the initial repository setup, authentication, Pages settings and the `v0.0` release, follow the [deployment guide](docs/DEPLOYMENT.md). No custom domain, separate website repository or manually maintained build branch is needed.

## Project structure

```text
.github/workflows/pages.yml  Verification and Pages deployment
docs/                       Rules, architecture, portraits and publishing
public/portraits/            48 independent character SVGs and a fallback
src/
  data/                     Card definitions, Chinese ability text, gallery queries
  game/                     Pure TypeScript types, rules, engine, effects and AI
  components/               Cards, battlefield, hand, gallery and result banner
  presentation/             Battle snapshots and browser-generated result sounds
  App.vue                   UI selection, action dispatch and turn scheduling
  *.test.ts                 Rule, AI, presentation and component tests
scripts/                    Reproducible AI benchmark tools
reports/ai-evaluation.md     AI evaluation results and limitations
```

See [Architecture](docs/ARCHITECTURE.md), [Portraits and references](docs/PORTRAITS.md) and [AI evaluation](reports/ai-evaluation.md).

## Scope and assets

Factions, relationship groups and rarities are abstractions for game mechanics, rather than formal historical classifications or measures of a person's significance.

The illustrations are locally authored SVG artwork. Reference photographs and paintings are linked in the portrait documentation; they are not included as downloaded image assets. No Blizzard artwork, card frames or fonts are bundled. Result sounds are synthesized with the browser's Web Audio API.

This is a playable prototype, with limited balance testing and a desktop-oriented layout. It does not include online multiplayer, deep AI search, deck building, collections, saves, equipment or event cards. Larger balance and feature changes are outside the frozen `v0.0` game.

Local reference books, generated artwork previews, benchmark replay JSON, installed dependencies and build outputs are excluded by `.gitignore`. Keep `package-lock.json` in the repository so installs and CI builds use the same dependency versions.
