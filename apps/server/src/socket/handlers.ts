import type { Server, Socket } from "socket.io";
import { ZodError, type ZodType } from "zod";
import {
  chatSchema,
  commandEnvelopeSchema,
  createRoomSchema,
  feedbackSchema,
  joinRoomSchema,
  kickSchema,
  resumeSchema,
  selectClanSchema,
  setReadySchema,
  type Ack,
  type AckFn,
  type ClientToServerEvents,
  type ErrorCode,
  type ServerToClientEvents,
} from "@clan-chaos/shared";
import { RoomError, type Room, type RoomManager } from "../rooms/RoomManager.js";
import { RateLimiter } from "../services/rateLimit.js";
import { newId } from "../services/tokens.js";

interface SocketData {
  roomCode?: string;
  playerId?: string;
}

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export interface RateLimitOptions {
  joinsPerMinute: number;
  chatPer5s: number;
  commandsPerSecond: number;
}

export const DEFAULT_RATE_LIMITS: RateLimitOptions = { joinsPerMinute: 20, chatPer5s: 5, commandsPerSecond: 25 };

function parse<T>(schema: ZodType<T>, payload: unknown): T {
  return schema.parse(payload);
}

function toAckError(err: unknown): Ack<never> {
  if (err instanceof ZodError) {
    return { ok: false, code: "VALIDATION", message: err.issues.map((i) => i.message).join("; ") };
  }
  if (err instanceof RoomError) return { ok: false, code: err.code, message: err.message };
  console.error("[socket] unexpected error", err);
  return { ok: false, code: "INTERNAL", message: "Something went wrong on the server" };
}

/** Wraps a handler so it always acknowledges exactly once and never throws into Socket.IO. */
function safe<P, T>(fn: (payload: P) => T, ack: unknown): (payload: P) => void {
  const reply = (typeof ack === "function" ? ack : () => undefined) as AckFn<T extends object ? T : never>;
  return (payload: P) => {
    try {
      const result = fn(payload);
      reply({ ok: true, ...(result as object) } as Ack<T extends object ? T : never>);
    } catch (err) {
      reply(toAckError(err) as Ack<T extends object ? T : never>);
    }
  };
}

export function broadcastLobby(io: GameServer, rooms: RoomManager, room: Room): void {
  io.to(`room:${room.code}`).emit("lobby:state", rooms.lobbyState(room));
}

export function broadcastMatch(io: GameServer, room: Room): void {
  if (!room.match) return;
  for (const p of room.players) {
    if (p.socketId) io.to(p.socketId).emit("game:state", room.match.viewFor(p.id));
  }
}

export function registerHandlers(io: GameServer, rooms: RoomManager, limits: RateLimitOptions = DEFAULT_RATE_LIMITS): void {
  const joinLimiter = new RateLimiter(limits.joinsPerMinute, 60_000);
  const chatLimiter = new RateLimiter(limits.chatPer5s, 5_000);
  const commandLimiter = new RateLimiter(limits.commandsPerSecond, 1_000);
  io.on("connection", (socket: GameSocket) => {
    const ip = socket.handshake.address;

    const current = (): { room: Room; playerId: string } => {
      const { roomCode, playerId } = socket.data;
      if (!roomCode || !playerId) throw new RoomError("NOT_IN_ROOM", "Join a room first");
      const room = rooms.get(roomCode);
      rooms.requirePlayer(room, playerId);
      return { room, playerId };
    };

    const attach = (room: Room, playerId: string) => {
      if (socket.data.roomCode && socket.data.roomCode !== room.code) void socket.leave(`room:${socket.data.roomCode}`);
      socket.data.roomCode = room.code;
      socket.data.playerId = playerId;
      void socket.join(`room:${room.code}`);
      socket.emit("lobby:state", rooms.lobbyState(room));
      socket.emit("chat:history", room.chat.slice(-50));
      if (room.match) socket.emit("game:state", room.match.viewFor(playerId));
    };

    const limited = (ok: boolean) => {
      if (!ok) throw new RoomError("VALIDATION", "Too many requests, slow down");
    };

    socket.on("room:create", (payload, ack) =>
      safe((p: unknown) => {
        limited(joinLimiter.allow(ip));
        const { name } = parse(createRoomSchema, p);
        const { room, player, token } = rooms.create(name, socket.id);
        attach(room, player.id);
        return { roomCode: room.code, playerId: player.id, token };
      }, ack)(payload),
    );

    socket.on("room:join", (payload, ack) =>
      safe((p: unknown) => {
        limited(joinLimiter.allow(ip));
        const { code, name } = parse(joinRoomSchema, p);
        const { room, player, token } = rooms.join(code, name, socket.id);
        attach(room, player.id);
        return { roomCode: room.code, playerId: player.id, token };
      }, ack)(payload),
    );

    socket.on("room:resume", (payload, ack) =>
      safe((p: unknown) => {
        limited(joinLimiter.allow(ip));
        const { code, token } = parse(resumeSchema, p);
        const { room, player, previousSocket } = rooms.resume(code, token, socket.id);
        if (previousSocket && previousSocket !== socket.id) {
          io.sockets.sockets.get(previousSocket)?.disconnect(true);
        }
        attach(room, player.id);
        return { playerId: player.id };
      }, ack)(payload),
    );

    socket.on("room:leave", (_payload, ack) =>
      safe(() => {
        const { room, playerId } = current();
        rooms.leave(room.code, playerId);
        void socket.leave(`room:${room.code}`);
        socket.data.roomCode = undefined;
        socket.data.playerId = undefined;
        return {};
      }, ack)(_payload),
    );

    socket.on("lobby:selectClan", (payload, ack) =>
      safe((p: unknown) => {
        const { room, playerId } = current();
        rooms.selectClan(room, playerId, parse(selectClanSchema, p).clan);
        return {};
      }, ack)(payload),
    );

    socket.on("lobby:setReady", (payload, ack) =>
      safe((p: unknown) => {
        const { room, playerId } = current();
        rooms.setReady(room, playerId, parse(setReadySchema, p).ready);
        return {};
      }, ack)(payload),
    );

    socket.on("lobby:kick", (payload, ack) =>
      safe((p: unknown) => {
        const { room, playerId } = current();
        const target = rooms.kick(room, playerId, parse(kickSchema, p).playerId);
        if (target.socketId) {
          const s = io.sockets.sockets.get(target.socketId);
          s?.emit("room:kicked", { reason: "The host removed you from the room" });
          void s?.leave(`room:${room.code}`);
          if (s) s.data = {};
        }
        return {};
      }, ack)(payload),
    );

    socket.on("lobby:start", (payload, ack) =>
      safe(() => {
        const { room, playerId } = current();
        rooms.start(room, playerId);
        return {};
      }, ack)(payload),
    );

    socket.on("room:returnToLobby", (payload, ack) =>
      safe(() => {
        const { room, playerId } = current();
        rooms.returnToLobby(room, playerId);
        return {};
      }, ack)(payload),
    );

    socket.on("game:sync", (payload, ack) =>
      safe(() => {
        const { room, playerId } = current();
        socket.emit("lobby:state", rooms.lobbyState(room));
        if (room.match) socket.emit("game:state", room.match.viewFor(playerId));
        return {};
      }, ack)(payload),
    );

    socket.on("game:command", (payload, ack) => {
      const reply = (typeof ack === "function" ? ack : () => undefined) as AckFn<{ seq: number }>;
      try {
        const { room, playerId } = current();
        if (!commandLimiter.allow(socket.id)) {
          reply({ ok: false, code: "RATE_LIMITED", message: "Too many actions, slow down" });
          return;
        }
        if (!room.match) throw new RoomError("ROOM_IN_PROGRESS", "No match is running");
        const env = parse(commandEnvelopeSchema, payload);
        const res = room.match.command(playerId, env.commandId, env.command);
        if (res.ok) reply({ ok: true, seq: res.seq });
        else reply({ ok: false, code: (res.code ?? "INVALID") as ErrorCode, message: res.message ?? "Not allowed" });
      } catch (err) {
        reply(toAckError(err));
      }
    });

    socket.on("feedback:submit", (payload, ack) => {
      const reply = (typeof ack === "function" ? ack : () => undefined) as AckFn<{ stored: boolean }>;
      try {
        const { room, playerId } = current();
        const match = room.match;
        if (!match || !match.finished) throw new RoomError("VALIDATION", "Feedback opens when the match ends");
        if (!chatLimiter.allow(`feedback:${room.code}:${playerId}`)) throw new RoomError("VALIDATION", "Please wait a moment before sending again");
        const answers = feedbackSchema.parse(payload);
        const player = match.state.players[playerId];
        const record = { matchId: match.state.id, playerId, name: player?.name ?? "?", clan: player?.clan ?? "?", ...answers };
        match.persist(() => rooms.persistence.saveFeedback(record));
        reply({ ok: true, stored: rooms.persistence.enabled });
      } catch (err) {
        reply(toAckError(err));
      }
    });

    socket.on("chat:send", (payload, ack) =>
      safe((p: unknown) => {
        const { room, playerId } = current();
        if (!chatLimiter.allow(`${room.code}:${playerId}`)) throw new RoomError("VALIDATION", "You're chatting too fast");
        const { text } = parse(chatSchema, p);
        const from = rooms.requirePlayer(room, playerId);
        const msg = { id: newId("c"), fromId: playerId, fromName: from.name, text, at: Date.now() };
        room.chat.push(msg);
        if (room.chat.length > 200) room.chat.splice(0, room.chat.length - 200);
        io.to(`room:${room.code}`).emit("chat:message", msg);
        return {};
      }, ack)(payload),
    );

    socket.on("disconnect", () => {
      const { roomCode, playerId } = socket.data;
      if (roomCode && playerId) rooms.disconnect(roomCode, playerId, socket.id);
    });
  });
}
