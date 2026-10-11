# Socket Protocol

Typed contracts are in `packages/shared/src/protocol.ts`. Every client→server event uses a Socket.IO acknowledgement that replies with `{ ok: true, ... }` or `{ ok: false, code, message }`. The error codes are listed as `ErrorCode` in that file.

## Client → server
| Event | Payload | Ack |
|---|---|---|
| `room:create` | `{ name }` | `{ roomCode, playerId, token }` |
| `room:join` | `{ code, name }` | same as above (only allowed in the lobby) |
| `room:resume` | `{ code, token }` | `{ playerId }`: reattaches this socket to the existing clan |
| `room:leave` | `{}` | |
| `lobby:selectClan` | `{ clan }` | |
| `lobby:setReady` | `{ ready }` | |
| `lobby:kick` | `{ playerId }` | host only, lobby only |
| `lobby:start` | `{}` | host only; needs at least 2 players, all connected and ready |
| `room:returnToLobby` | `{}` | host only, after the match ends (rematch) |
| `game:command` | `{ commandId, command }` | `{ seq }` |
| `chat:send` | `{ text }` | |
| `game:sync` | `{}` | asks the server to resend lobby and game state |

`command` is one of the following (see `gameCommandSchema`):
`gather`, `recall`, `buildBarricade`, `repairFort`, `recruitMercenaries`, `buyCard`, `buyMerchantCard`, `clanGrowth`, `trainParty`, `scout`, `playCard`, `commitDefense`, `commitRaid`, `useClanAbility`, `foxfireRetarget`, `tradeOffer`, `tradeRespond`, `tradeCancel`, `marketExchange`, `truceRespond`.

`commandId` must be 8–64 characters and unique per player. Resending an id returns the original result and applies nothing new.

## Server → client
| Event | Payload |
|---|---|
| `lobby:state` | `LobbyState`: players, host, readiness, start blockers, room status |
| `game:state` | `PlayerView`: that player's authorized view, including `seq` and `serverNow` |
| `chat:message` / `chat:history` | chat messages |
| `room:kicked` | `{ reason }` |

Raid reveals arrive inside `game:state` as `resolutions` once the Resolution phase starts. Before that point they don't exist in any payload. Disconnect and reconnect status, elimination, events and match results also arrive through `game:state` (fields `players[].connected`, `players[].inactive`, `players[].eliminated`, `activeEvent`, `upcomingEventNotice` and `results`).
