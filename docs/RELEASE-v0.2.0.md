# Cultural Revolution: The Game v0.2.0

Released: October 10, 2026.

This update adds a shared event-card pool and a stronger local AI, and improves hand flow, effect timing and battle feedback.

- Add 12 single-use public events with two face-up slots. The pool opens on player 2's turn in round 4 (individual turn 8); each player may use one event per turn. Characters and events have separate gallery sections and card layouts.
- Introduce AI 2.0: bounded whole-turn planning with limited opponent replies, hidden-card sampling and a local Web Worker. The greedy policy remains available as a fallback and benchmark baseline.
- Give both players five starting cards. Refill to five at each owner's turn start before return and directive effects; excess cards are retained, and skills may draw beyond five.
- Clarify turns versus rounds. Big-Character Poster reduces attack until the caster's next turn starts; Support, Rectification and event attack changes last only for the current turn. Restore Lin Biao's initial countdown to three.
- Keep damage and death animations playing independently while accepting the next legal action. Survivors retain their visual positions until death effects finish, then close the gaps. Live stats and targets remain current throughout.
- Add a brief local sound when the opponent hands control back. Color revealed-hand names and borders by faction, separate desktop events from characters with a wider gap and divider, and use shared event-name references in the rules.
- Synchronize the new rules and presentation in host-authoritative multiplayer. Older incompatible clients must refresh before joining.

Verification: 294 tests passed; TypeScript checking and production build passed. Browser checks covered nonblocking actions, delayed visual compaction, event unlock/use and common desktop and portrait layouts. Historical AI simulation reports record their tested rules and are not a guarantee of current balance.
