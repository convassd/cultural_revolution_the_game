# Multiplayer

The home screen offers **双人联机** (Online multiplayer) and **AI对战** (AI battle). Online multiplayer replaces the earlier hot-seat menu entry. No account, backend deployment, database, game-server process or Pages configuration change is needed.

The approach follows [ArcoMage HD's multiplayer mode](https://github.com/arcomage/arcomage-hd#multiplayer-mode): a static website, PeerJS signaling, WebRTC data channels and manually shared IDs. Here, the room creator is the authoritative host. Both players use the same build of the game.

## Two-window test on one computer

1. Run `npm ci` once if dependencies need installing, then `npm run dev`. On PowerShell, use `npm.cmd` if necessary.
2. Open the printed local URL in two browser windows. Separate tabs also work; two windows make synchronization easier to observe.
3. In window A, select **双人联机**, then **创建房间** (Create room).
4. Wait for the room ID. Click **复制 ID** (Copy ID), or select the read-only ID field and copy it manually.
5. In window B, select **双人联机**, paste the ID into **朋友的房间 ID**, then select **加入房间** (Join room). Pressing Enter in the field also submits.
6. Both windows should enter the match automatically. The host may go first or second; each browser shows **你** (You) at the bottom and only its own hand. Exactly one player has an enabled **结束回合** (End turn) button.
7. End the first player's turn. The other window should draw one card, refill resources and enable its actions without a handoff screen. Play an affordable card; it should appear as a friendly card locally and an enemy card in the other window.
8. In later turns, attack a character and attack the player. Check matching HP, deaths, faction damage, relationship bonuses and logs. Both windows should show damage/death effects; after state synchronization the next legal action is allowed while earlier effects continue. End a turn and check that only the incoming local player hears the short cue, once controls are available.
9. Test an entry-target skill: the card enters and spends resources immediately, then only its owner can choose a highlighted target. Test Kang Sheng: enemy card names replace backs only for the caster, then disappear on the caster's next selection or action.
10. Finish the match. The winner sees **全面胜利**, the loser **退出舞台**. The host can select **再来一局** (Play again) after synchronization; both windows receive a new match and randomized seats.
11. In either window, select **返回** (Back), refresh or close the page. The other window must report disconnection and disable actions. Return to the menu and create a new room to play again.

Internet access is still required for PeerJS signaling, even though the game files are served locally. A room created on a deployed website can also connect to a local copy if their protocol and card/rule data match.

## Two devices

After deploying the updated build, open the same GitHub Pages game URL on both devices. Use the create/share/join sequence above. HTTPS is recommended, and is already provided by GitHub Pages. Nothing needs to be installed on the second device.

For local development on two devices connected to the same LAN, run:

```sh
npm run dev -- --host 0.0.0.0
```

Use Vite's printed Network URL on the second device. Allow the development server through the operating system firewall for your private network if needed. Clipboard APIs may not work on plain LAN HTTP; manually select and copy the room ID instead. If a browser refuses WebRTC on the LAN URL, use the HTTPS-deployed build. A `localhost` URL always refers to the device opening it, so do not send your computer's localhost URL to a phone.

Also test different networks, such as home Wi-Fi versus mobile data. A successful two-window test confirms the game integration; it does not guarantee that every internet/NAT combination will connect.

## Connection services and limits

- PeerJS is bundled through npm. It uses its public HTTPS/WSS PeerServer for peer discovery and signaling. The service exchanges connection metadata; it does not run the game engine.
- The app configures public STUN endpoints at `stun.l.google.com:19302` and `stun.cloudflare.com:3478` for direct connectivity. No TURN relay is configured.
- Once connected, game messages travel over the encrypted WebRTC data channel. There is one host and one guest; no public lobby list or matchmaking exists.
- Symmetric NAT, restrictive firewalls, blocked UDP or inaccessible public services can prevent connection. A timeout is shown rather than starting an unsynchronized game. Try another network; ID sharing cannot bypass NAT restrictions.
- Refreshing or leaving destroys the connection. Heartbeats detect silent connection loss after roughly 30 seconds. There is no reconnection, saved online match or host migration in this version.
- Only one guest is accepted. Additional peers are rejected. The room ID is a temporary invitation; share it with the intended opponent.
- The host is trusted. Guest views omit the opponent's hand IDs and deck order, but the host necessarily has full game state and can modify its own browser. No competitive anti-cheat guarantee is provided.

See the [PeerJS guide](https://peerjs.com/client/getting-started), [Peer API](https://peerjs.com/client/api/peer) and [ArcoMage HD connection notes](https://github.com/arcomage/arcomage-hd#technical-details).

## Troubleshooting

- **No room ID:** check internet access and whether the network allows the public PeerJS service; return and retry.
- **Room does not exist:** check the copied ID and keep the host page open. Every new room has a new ID.
- **Connection timeout:** try another network or browser. There is no TURN fallback.
- **Different versions:** refresh both pages and retry. The handshake checks the wire protocol and card/rule data; incompatible engine updates must increment the protocol identifier.
- **Waiting for synchronization:** wait for both browsers to receive and acknowledge the new state; animations do not hold the acknowledgement. Keep both pages open and devices awake. After a disconnect, return to the menu and create a new room.

Automated tests cover host authority, seat binding, privacy, stale requests, acknowledgements, lifecycle and UI behavior. Manual cross-network tests remain necessary to assess the public services and the players' NAT/firewall conditions.

Implementation verification also completed a full game in two real Chrome pages through the public PeerJS service and native WebRTC, checking private opening hands, action locks, damage effects, final HP/board/log agreement, host rematch, departure and return to AI mode. A separate native WebRTC test with ephemeral test-only signaling exercised entry-target selection. Neither test signal service nor generated screenshots are included in the production build.
