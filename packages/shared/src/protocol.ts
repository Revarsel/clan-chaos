import type { ClanId } from "./types.js";
import type { PlayerView } from "./views.js";

export type ErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "ROOM_FULL"
  | "ROOM_IN_PROGRESS"
  | "NOT_HOST"
  | "NOT_IN_ROOM"
  | "NOT_READY"
  | "BAD_TOKEN"
  | "RATE_LIMITED"
  | "WRONG_PHASE"
  | "INSUFFICIENT"
  | "LIMIT"
  | "INVALID"
  | "ELIMINATED"
  | "INACTIVE"
  | "INTERNAL";

export interface AckError {
  ok: false;
  code: ErrorCode;
  message: string;
}
export type Ack<T = Record<string, never>> = ({ ok: true } & T) | AckError;
export type AckFn<T = Record<string, never>> = (ack: Ack<T>) => void;

export interface LobbyPlayer {
  id: string;
  name: string;
  clan: ClanId;
  ready: boolean;
  isHost: boolean;
  connected: boolean;
  color: string;
}

export interface LobbyState {
  code: string;
  status: "lobby" | "in_match" | "finished";
  hostId: string;
  players: LobbyPlayer[];
  minPlayers: number;
  maxPlayers: number;
  canStart: boolean;
  startBlockers: string[];
}

export interface ChatMessage {
  id: string;
  fromId: string;
  fromName: string;
  text: string;
  at: number;
}

export interface SessionInfo {
  roomCode: string;
  playerId: string;
  token: string;
}

export interface ClientToServerEvents {
  "room:create": (payload: { name: string }, ack: AckFn<SessionInfo>) => void;
  "room:join": (payload: { code: string; name: string }, ack: AckFn<SessionInfo>) => void;
  "room:resume": (payload: { code: string; token: string }, ack: AckFn<{ playerId: string }>) => void;
  "room:leave": (payload: Record<string, never>, ack: AckFn) => void;
  "lobby:selectClan": (payload: { clan: ClanId }, ack: AckFn) => void;
  "lobby:setReady": (payload: { ready: boolean }, ack: AckFn) => void;
  "lobby:kick": (payload: { playerId: string }, ack: AckFn) => void;
  "lobby:start": (payload: Record<string, never>, ack: AckFn) => void;
  "room:returnToLobby": (payload: Record<string, never>, ack: AckFn) => void;
  "game:command": (payload: unknown, ack: AckFn<{ seq: number }>) => void;
  "chat:send": (payload: { text: string }, ack: AckFn) => void;
  "game:sync": (payload: Record<string, never>, ack: AckFn) => void;
}

export interface ServerToClientEvents {
  "lobby:state": (state: LobbyState) => void;
  "game:state": (view: PlayerView) => void;
  "chat:message": (msg: ChatMessage) => void;
  "chat:history": (msgs: ChatMessage[]) => void;
  "room:kicked": (payload: { reason: string }) => void;
}
