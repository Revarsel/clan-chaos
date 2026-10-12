import type { ChatMessage, ClanId, LobbyState } from "@clan-chaos/shared";
import { CLAN_IDS } from "@clan-chaos/shared";
import { DEFAULT_CONFIG, PLAYER_COLORS, type MatchConfig } from "@clan-chaos/game-content";
import { MatchRunner } from "../matches/MatchRunner.js";
import type { Persistence } from "../persistence/persistence.js";
import { hashToken, newId, newRoomCode, newToken, tokenMatches } from "../services/tokens.js";

export interface RoomPlayer {
  id: string;
  name: string;
  clan: ClanId;
  ready: boolean;
  tokenHash: string;
  connected: boolean;
  socketId: string | null;
  color: string;
}

export interface Room {
  code: string;
  hostId: string;
  status: "lobby" | "in_match" | "finished";
  players: RoomPlayer[];
  match: MatchRunner | null;
  chat: ChatMessage[];
  lastActivity: number;
}

export class RoomError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "ROOM_FULL"
      | "ROOM_IN_PROGRESS"
      | "NOT_HOST"
      | "NOT_READY"
      | "BAD_TOKEN"
      | "VALIDATION"
      | "NOT_IN_ROOM",
    message: string,
  ) {
    super(message);
  }
}

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface RoomManagerOptions {
  persistence: Persistence;
  matchConfig: Partial<MatchConfig>;
  onRoomChanged: (room: Room) => void;
  onMatchChanged: (room: Room) => void;
}

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  readonly maxPlayers = DEFAULT_CONFIG.maxPlayers;
  readonly minPlayers = DEFAULT_CONFIG.minPlayers;

  constructor(private readonly opts: RoomManagerOptions) {}

  get persistence(): Persistence {
    return this.opts.persistence;
  }

  get(code: string): Room {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new RoomError("NOT_FOUND", "No room with that code");
    return room;
  }

  private uniqueName(room: Room, name: string): string {
    const taken = new Set(room.players.map((p) => p.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; i < 20; i++) {
      const candidate = `${name.slice(0, 13)} ${i}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return `${name.slice(0, 10)} ${Math.floor(Math.random() * 1000)}`;
  }

  private freeColor(room: Room): string {
    return PLAYER_COLORS.find((c) => !room.players.some((p) => p.color === c)) ?? PLAYER_COLORS[0]!;
  }

  private addPlayer(room: Room, name: string, socketId: string) {
    const token = newToken();
    const player: RoomPlayer = {
      id: newId("p"),
      name: this.uniqueName(room, name),
      clan: CLAN_IDS[room.players.length % CLAN_IDS.length]!,
      ready: false,
      tokenHash: hashToken(token),
      connected: true,
      socketId,
      color: this.freeColor(room),
    };
    room.players.push(player);
    room.lastActivity = Date.now();
    void this.opts.persistence
      .saveSession({
        id: player.id,
        name: player.name,
        roomCode: room.code,
        tokenHash: player.tokenHash,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      })
      .catch((e: unknown) => console.error("[persistence] saveSession:", e instanceof Error ? e.message : e));
    return { player, token };
  }

  create(name: string, socketId: string) {
    let code = newRoomCode();
    while (this.rooms.has(code)) code = newRoomCode();
    const room: Room = { code, hostId: "", status: "lobby", players: [], match: null, chat: [], lastActivity: Date.now() };
    this.rooms.set(code, room);
    const { player, token } = this.addPlayer(room, name, socketId);
    room.hostId = player.id;
    return { room, player, token };
  }

  join(code: string, name: string, socketId: string) {
    const room = this.get(code);
    if (room.status !== "lobby") throw new RoomError("ROOM_IN_PROGRESS", "That match has already started (late joining is not allowed)");
    if (room.players.length >= this.maxPlayers) throw new RoomError("ROOM_FULL", "That room is full (8 players)");
    const { player, token } = this.addPlayer(room, name, socketId);
    this.opts.onRoomChanged(room);
    return { room, player, token };
  }

  /** Re-attaches a socket to an existing identity using its secret reconnect token. */
  resume(code: string, token: string, socketId: string) {
    const room = this.get(code);
    const player = room.players.find((p) => tokenMatches(token, p.tokenHash));
    if (!player) throw new RoomError("BAD_TOKEN", "Your session for this room is no longer valid");
    const previousSocket = player.socketId;
    player.socketId = socketId;
    player.connected = true;
    room.lastActivity = Date.now();
    room.match?.setConnected(player.id, true);
    void this.opts.persistence.touchSession(player.id).catch(() => undefined);
    this.opts.onRoomChanged(room);
    return { room, player, previousSocket };
  }

  disconnect(code: string, playerId: string, socketId: string): void {
    const room = this.rooms.get(code);
    const player = room?.players.find((p) => p.id === playerId);
    if (!room || !player || player.socketId !== socketId) return; // a newer socket already took over
    player.connected = false;
    player.socketId = null;
    if (room.status === "lobby") player.ready = false;
    room.match?.setConnected(playerId, false);
    this.reassignHost(room);
    this.opts.onRoomChanged(room);
  }

  leave(code: string, playerId: string): void {
    const room = this.get(code);
    if (room.status === "lobby") {
      room.players = room.players.filter((p) => p.id !== playerId);
    } else {
      const p = room.players.find((x) => x.id === playerId);
      if (p) {
        p.connected = false;
        p.socketId = null;
      }
      room.match?.setConnected(playerId, false);
    }
    this.reassignHost(room);
    if (room.players.length === 0) this.destroy(room);
    else this.opts.onRoomChanged(room);
  }

  private reassignHost(room: Room): void {
    const host = room.players.find((p) => p.id === room.hostId);
    if (host?.connected) return;
    const next = room.players.find((p) => p.connected);
    if (next) room.hostId = next.id;
    else if (!host && room.players[0]) room.hostId = room.players[0].id;
  }

  requirePlayer(room: Room, playerId: string): RoomPlayer {
    const p = room.players.find((x) => x.id === playerId);
    if (!p) throw new RoomError("NOT_IN_ROOM", "You are not in this room");
    return p;
  }

  selectClan(room: Room, playerId: string, clan: ClanId): void {
    if (room.status !== "lobby") throw new RoomError("ROOM_IN_PROGRESS", "Clans are locked once the match starts");
    const p = this.requirePlayer(room, playerId);
    p.clan = clan;
    p.ready = false;
    this.opts.onRoomChanged(room);
  }

  setReady(room: Room, playerId: string, ready: boolean): void {
    if (room.status !== "lobby") throw new RoomError("ROOM_IN_PROGRESS", "The match has already started");
    this.requirePlayer(room, playerId).ready = ready;
    this.opts.onRoomChanged(room);
  }

  kick(room: Room, hostId: string, targetId: string): RoomPlayer {
    if (room.hostId !== hostId) throw new RoomError("NOT_HOST", "Only the host can do that");
    if (room.status !== "lobby") throw new RoomError("ROOM_IN_PROGRESS", "You can only remove players in the lobby");
    if (targetId === hostId) throw new RoomError("VALIDATION", "You cannot remove yourself");
    const target = this.requirePlayer(room, targetId);
    room.players = room.players.filter((p) => p.id !== targetId);
    this.opts.onRoomChanged(room);
    return target;
  }

  startBlockers(room: Room): string[] {
    const blockers: string[] = [];
    if (room.players.length < this.minPlayers) blockers.push(`Need at least ${this.minPlayers} players`);
    for (const p of room.players) {
      if (!p.connected) blockers.push(`${p.name} is disconnected`);
      else if (!p.ready) blockers.push(`${p.name} is not ready`);
    }
    return blockers;
  }

  start(room: Room, playerId: string): void {
    if (room.hostId !== playerId) throw new RoomError("NOT_HOST", "Only the host can start the match");
    if (room.status !== "lobby") throw new RoomError("ROOM_IN_PROGRESS", "The match has already started");
    const blockers = this.startBlockers(room);
    if (blockers.length) throw new RoomError("NOT_READY", blockers.join("; "));
    const seed = newId("seed");
    room.status = "in_match";
    room.match = new MatchRunner({
      id: newId("m"),
      seed,
      roomCode: room.code,
      players: room.players.map((p) => ({ id: p.id, name: p.name, clan: p.clan })),
      config: this.opts.matchConfig,
      persistence: this.opts.persistence,
      sessionIds: Object.fromEntries(room.players.map((p) => [p.id, p.id])),
      onChange: () => this.opts.onMatchChanged(room),
      onFinished: () => {
        room.status = "finished";
        this.opts.onRoomChanged(room);
      },
    });
    room.match.start();
    this.opts.onRoomChanged(room);
    this.opts.onMatchChanged(room);
  }

  returnToLobby(room: Room, playerId: string): void {
    if (room.hostId !== playerId) throw new RoomError("NOT_HOST", "Only the host can do that");
    if (room.status !== "finished") throw new RoomError("ROOM_IN_PROGRESS", "The match is still running");
    room.match?.stop();
    room.match = null;
    room.status = "lobby";
    for (const p of room.players) p.ready = false;
    this.opts.onRoomChanged(room);
  }

  lobbyState(room: Room): LobbyState {
    const blockers = this.startBlockers(room);
    return {
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        clan: p.clan,
        ready: p.ready,
        isHost: p.id === room.hostId,
        connected: p.connected,
        color: p.color,
      })),
      minPlayers: this.minPlayers,
      maxPlayers: this.maxPlayers,
      canStart: blockers.length === 0 && room.status === "lobby",
      startBlockers: blockers,
    };
  }

  destroy(room: Room): void {
    room.match?.stop();
    if (room.match && !room.match.finished) {
      const id = room.match.state.id;
      void this.opts.persistence.matchAbandoned(id).catch(() => undefined);
    }
    this.rooms.delete(room.code);
  }

  /** Removes rooms with nobody connected for a while. */
  sweep(now = Date.now(), idleMs = 30 * 60 * 1000): void {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.connected)) room.lastActivity = now;
      else if (now - room.lastActivity > idleMs) this.destroy(room);
    }
  }
}
