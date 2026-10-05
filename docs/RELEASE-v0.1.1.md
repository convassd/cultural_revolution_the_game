# Cultural Revolution: The Game v0.1.1

[Play in your browser](https://convassd.github.io/cultural_revolution_the_game/)

This patch unifies card presentation and establishes the game's English title and three-part release numbering. Gameplay remains the same as v0.1.0.

- The gallery, hand and battlefield share one card-face component and scoped visual styles, including portrait layout, faction colors, skill text and stats.
- All cards inherit the same viewport-based dimensions and 3:4 proportions. The gallery arranges fixed-size cards without stretching them to fill a row.
- A red five-pointed SVG star appears as the browser favicon; its relative production path supports GitHub Pages deployment under the repository directory.
- The English title is **Cultural Revolution: The Game**. The Chinese game title remains **文革杀**.
- The page's version label reads from `package.json`, avoiding a separate hardcoded version.

## Version history

Earlier informal labels are now recorded by tags at their original commits:

| Earlier label | Release tag | Original commit |
| --- | --- | --- |
| v0.0 | v0.0.0 | ffc0e2d |
| v0.1 | v0.0.1 | 5d18846 |
| v0.2 | v0.1.0 | 271f8cb |

Git history and historical package labels are preserved. The new three-part versions are the release labels; this is not a rollback of the game's rules.

## Verification

203 automated tests, TypeScript checking and the production build pass. Browser checks at 1366×768, 1366×650, 1920×1080 and 390×844 confirm matching card dimensions and styles across the gallery, hand and battlefield, uniform gallery cards, no gallery page-width overflow and functioning target highlights.

GitHub Pages continues to deploy verified pushes to `main`. Releases record source snapshots; publishing a tag alone does not switch the live website to that tag.
