# Wen Ge Sha v0.2

[Play in your browser](https://convassd.github.io/cultural_revolution_the_game/)

This update introduces online multiplayer and revises all five SSR abilities. Local AI battles remain available.

## Online multiplayer

- Online multiplayer replaces the home-screen hot-seat mode. Create a room, share its ID, and join from another browser or device.
- PeerJS signaling establishes a WebRTC data channel. The host runs the authoritative game engine; guests send validated action requests and receive snapshots with hidden opponent hands and deck contents.
- Seats are randomized at the start of every match. Both browsers wait for synchronized battle animations; the host can start a rematch after victory.
- Leaving closes the connection. Disconnects freeze the match and require a new room; there is no reconnect or matchmaking system.
- The static site needs no self-hosted game server. Multiplayer uses public signaling and STUN services; no TURN relay is configured, so some networks cannot connect.

See [Multiplayer testing and troubleshooting](MULTIPLAYER.md).

## SSR changes

- **Mao Zedong:** seven cost, four attack, eight HP. Entry heals the friendly player for five HP without a 20-HP cap. A roll of six deals six damage to all characters except this Mao and Zhang Yufeng on either side.
- **Jiang Qing — Borrowed Power:** entry draws one Rebel from the deck. A living friendly Mao grants a dynamic +2 attack, stacking with the usual group aura. The former full-group player-damage trigger is removed.
- **Deng Xiaoping — Rectification:** each actual return gives other friendly Conservatives already in play +1, +2 or +3 attack for the current turn, matching the return count. His return stats and resting restriction remain unchanged.
- **Lin Biao:** countdown starts at two. Any death departure triggers the two-damage blast, including early combat or ability deaths; Ye Qun and Lin Liguo on either side die directly. A successful Mediation rescue prevents departure and the blast.
- **Zhou Enlai:** now Unaffiliated. Mediation can trigger during either player's turn, once per global turn.

Card descriptions and the rules guide reflect these changes. Multiplayer rejects connections using incompatible rulesets. The older AI benchmark is marked as historical rather than evidence of current balance.

## Verification

203 automated tests pass, covering rules, SSR interactions, seeded complete matches, AI, presentation, Vue UI and multiplayer protocol/session behavior. TypeScript checking and the production build pass. Multiplayer also underwent two-browser connection, complete-match, rematch and disconnect checks.

GitHub Pages automatically deploys the verified build pushed to main.
