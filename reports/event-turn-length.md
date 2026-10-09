# Match length after public events

Adding events did not substantially shorten matches in this comparison: mean match length changed from 11.805 to 11.630 individual player turns, a reduction of 0.175 turns (1.48%).

## Method

Compare AI 2.0 versus the retained greedy policy on the same 100 deck seeds, 81001–81100, swapping policies between seats: 200 matches per version. Use 20 initial HP, five-card refill, the same search limits and independent seeded shuffle/live-dice streams. The before result is the saved pre-event validation; the after result is a new run with all 12 public events and Lin Biao's countdown restored from two to three. Both versions finished all matches without draws or invalid actions. This compares the complete versions, not the isolated effect of events.

One turn means one player's action period. A complete round containing both players' turns counts as two. The benchmark has a deterministic node cap rather than the browser's wall-clock deadline.

| Match length | Before events | Events and three-countdown Lin |
| --- | --- | --- |
| AI 2.0 opening: mean turns | 11.280 | 11.300 |
| AI 2.0 second: mean turns | 12.330 | 11.960 |
| All 200 matches: mean turns | 11.805 | 11.630 |

AI 2.0 used 78 events and greedy used 127, totaling 205 uses over 200 matches. The small difference in means does not establish a robust shortening across other policies, seeds or human play. No formal significance test was performed. Changes to Lin and hidden-world sampling also prevent attributing the entire difference to events alone.

The initial post-event smoke test used different seeds (91001–91010) and averaged 13.0 turns over 20 matches. It should not be directly compared with the earlier 200-match validation; the matched-seed comparison above supersedes that impression.

Generated JSON is gitignored. The preserved files are `ai-planner-vs-greedy-hp20-81001-100.json` (before) and `ai-planner-vs-greedy-events-hp20-81001-100.json` (after). The current benchmark command reruns the after version:

```sh
npm run benchmark:ai -- 100 81001 greedy 20 planner
```

The CLI normally overwrites its standard output filename; preserve historical JSON under a separate filename before running it.
