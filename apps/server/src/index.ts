import { createServer, type Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@clan-chaos/shared";
import type { ServerConfig } from "./config.js";
import { DisabledPersistence, PrismaPersistence, type Persistence } from "./persistence/persistence.js";
import { RoomManager } from "./rooms/RoomManager.js";
import { broadcastLobby, broadcastMatch, registerHandlers, type GameServer } from "./socket/handlers.js";

export interface GameServerHandle {
  http: HttpServer;
  io: GameServer;
  rooms: RoomManager;
  persistence: Persistence;
  port: number;
  close: () => Promise<void>;
}

export async function startGameServer(config: ServerConfig, persistence?: Persistence): Promise<GameServerHandle> {
  const store = persistence ?? (config.persistence ? new PrismaPersistence() : new DisabledPersistence());
  await store.init();

  const http = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
      res.end(JSON.stringify({ ok: true, rooms: rooms.rooms.size, persistence: store.enabled, time: Date.now() }));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Clan Chaos game server");
  });

  const io: GameServer = new Server<ClientToServerEvents, ServerToClientEvents>(http, {
    cors: { origin: config.corsOrigins === "*" ? true : config.corsOrigins },
    pingInterval: 10_000,
    pingTimeout: 8_000,
  });

  const rooms: RoomManager = new RoomManager({
    persistence: store,
    matchConfig: config.match,
    onRoomChanged: (room) => broadcastLobby(io, rooms, room),
    onMatchChanged: (room) => broadcastMatch(io, room),
  });
  registerHandlers(io, rooms, config.rateLimits);
  const sweeper = setInterval(() => rooms.sweep(), 60_000);

  await new Promise<void>((resolve) => http.listen(config.port, config.host, resolve));
  const addr = http.address();
  const port = typeof addr === "object" && addr ? addr.port : config.port;

  return {
    http,
    io,
    rooms,
    persistence: store,
    port,
    close: async () => {
      clearInterval(sweeper);
      for (const room of rooms.rooms.values()) {
        room.match?.stop();
        await room.match?.flush();
      }
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await store.close();
    },
  };
}
