# Cultural Revolution: The Game v0.3.0

Released: November 8, 2026.

This update replaces growing resources and public event slots with fixed income, card sales and persistent events in private decks, and introduces direct card-to-destination controls.

- Separately shuffle characters and events and split each evenly: each player receives 24 unique characters and six unique events. Interleave four characters followed by one event, giving each opening hand four characters and one event. Conditional skill draws can pull a matching card forward without rearranging the remaining deck.
- Start with five cards, then draw exactly three at each own turn start, skipping each player's opening automatic draw. Retain all hand cards. Energy resets to four each own turn; the second seat receives six extra energy on its opening turn only. Unspent energy does not carry over.
- Sell any hand card for its printed cost in energy, permanently removing it without entry or death effects. Sales are unlimited, can exceed base energy and cannot be undone.
- Mix all 12 events into private decks. One global active event persists until replaced. Attack auras continuously affect both sides, new arrivals and changed factions; entry damage, healing and draws resolve once. Remove public event slots, unlock rounds and the once-per-turn event limit.
- Make all character entry abilities automatic. Support buffs the highest-current-attack other ally; Escalation (上纲上线, formerly 大字报) weakens the strongest enemy until the caster's next turn. Ties use the leftmost eligible character.
- Play characters by selecting a hand card and clicking a friendly slot, or by dragging it there. Events use the active-event area. Sell through the new left-hand trash slot. Keep only energy and a tall End Turn button on the right. Clicking the selected card again or pressing Escape cancels selection; touch users can use two taps.
- Expose five independent UI hit positions for each side while keeping deployment left-aligned. Preserve nonblocking damage/death effects, including deployment while all five positions are shattering.
- Keep the victory/defeat banner visible after its entrance animation until restart, rematch or return to the menu. Play the result sound once.
- Update host-authoritative multiplayer to protocol 10 and include dealing rules in the ruleset fingerprint. Both peers need this build; existing connections cannot migrate.

Verification: 307 tests pass; TypeScript checking and the production build pass. Browser smoke checks verify the new opening mix and persistent result visibility, along with the updated card controls. The economy/hand-flow reports are historical experiments from before the final interleaved deal. Resource starvation improved in those tests, but first-seat advantage and short matches remain open playtest concerns; no current win-rate claim is made for this release.

No new dependencies, backend, account system or storage service are required. The existing main-branch GitHub Actions workflow builds and deploys the static website after a successful push.
