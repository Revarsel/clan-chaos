"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Ack, ChatMessage, GameCommand, LobbyState, PlayerView, SessionInfo } from "@clan-chaos/shared";
import { getSocket } from "@/lib/socket";
import { clearSession, loadSession, newCommandId, saveSession } from "@/lib/session";

export interface Toast {
  id: number;
  kind: "ok" | "error" | "info";
  text: string;
}

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline";

interface GameContextValue {
  code: string;
  status: ConnectionStatus;
  joined: boolean;
  /** True once a stored session has been tried (or there was none). */
  checked: boolean;
  joining: boolean;
  joinError: string | null;
  kicked: string | null;
  lobby: LobbyState | null;
  view: PlayerView | null;
  chat: ChatMessage[];
  toasts: Toast[];
  clockOffset: number;
  playerId: string | null;
  join: (name: string) => Promise<boolean>;
  leave: () => Promise<void>;
  emitAck: (event: AckEvent, payload: unknown) => Promise<Ack<Record<string, unknown>>>;
  send: (cmd: GameCommand, success?: string) => Promise<boolean>;
  /** Like send, but resolves with the server's reason when rejected. Success is only reported after the ack. */
  sendCommand: (cmd: GameCommand, success?: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  toast: (kind: Toast["kind"], text: string) => void;
}

type AckEvent =
  | "lobby:selectClan"
  | "lobby:setReady"
  | "lobby:kick"
  | "lobby:start"
  | "room:returnToLobby"
  | "chat:send"
  | "game:sync"
  | "feedback:submit";

const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}

const ACK_TIMEOUT_MS = 6000;

export function GameProvider({ code, children }: { code: string; children: React.ReactNode }) {
  const socket = useMemo(() => getSocket(), []);
  const [status, setStatus] = useState<ConnectionStatus>(socket.connected ? "connected" : "connecting");
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [checked, setChecked] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [kicked, setKicked] = useState<string | null>(null);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [clockOffset, setClockOffset] = useState(0);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const toastId = useRef(0);
  const lastSeq = useRef(-1);
  const lastMatch = useRef<string | null>(null);

  const toast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : kind === "info" ? 4500 : 3000);
  }, []);

  const emitAck = useCallback(
    (event: string, payload: unknown): Promise<Ack<Record<string, unknown>>> =>
      new Promise((resolve) => {
        const timer = setTimeout(
          () => resolve({ ok: false, code: "INTERNAL", message: "The server did not respond. Check your connection." }),
          ACK_TIMEOUT_MS,
        );
        (socket.emit as (e: string, p: unknown, cb: (a: Ack<Record<string, unknown>>) => void) => void)(
          event,
          payload,
          (ack) => {
            clearTimeout(timer);
            resolve(ack);
          },
        );
      }),
    [socket],
  );

  const resume = useCallback(async () => {
    const stored = loadSession(code);
    if (!stored) {
      setChecked(true);
      return false;
    }
    const ack = await emitAck("room:resume", { code, token: stored.token });
    setChecked(true);
    if (ack.ok) {
      setPlayerId(stored.playerId);
      setJoined(true);
      setJoinError(null);
      return true;
    }
    if (ack.code === "BAD_TOKEN" || ack.code === "NOT_FOUND") {
      clearSession(code);
      setJoined(false);
      setJoinError(ack.code === "NOT_FOUND" ? "That room no longer exists." : null);
    }
    return false;
  }, [code, emitAck]);

  useEffect(() => {
    const onConnect = () => {
      setStatus("connected");
      void resume();
    };
    const onDisconnect = () => setStatus("reconnecting");
    const onError = () => setStatus((s) => (s === "connected" ? "reconnecting" : "offline"));
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);
    socket.on("lobby:state", (s) => setLobby(s));
    socket.on("game:state", (v) => {
      if (v.matchId !== lastMatch.current) {
        lastMatch.current = v.matchId;
        lastSeq.current = -1;
      }
      if (v.seq < lastSeq.current) return; // stale update
      lastSeq.current = v.seq;
      setClockOffset(v.serverNow - Date.now());
      setView(v);
    });
    socket.on("chat:history", (msgs) => setChat(msgs));
    socket.on("chat:message", (m) => setChat((c) => [...c.slice(-199), m]));
    socket.on("room:kicked", ({ reason }) => {
      clearSession(code);
      setJoined(false);
      setKicked(reason);
    });
    if (socket.connected) onConnect();
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
      socket.off("lobby:state");
      socket.off("game:state");
      socket.off("chat:history");
      socket.off("chat:message");
      socket.off("room:kicked");
    };
  }, [socket, code, resume]);

  // Clear finished-match view when the room returns to the lobby.
  useEffect(() => {
    if (lobby?.status === "lobby") setView(null);
  }, [lobby?.status]);

  const join = useCallback(
    async (name: string) => {
      setJoining(true);
      setJoinError(null);
      const ack = (await emitAck("room:join", { code, name })) as Ack<SessionInfo>;
      setJoining(false);
      if (!ack.ok) {
        setJoinError(ack.message);
        return false;
      }
      saveSession(code, { playerId: ack.playerId, token: ack.token, name });
      setPlayerId(ack.playerId);
      setJoined(true);
      return true;
    },
    [code, emitAck],
  );

  const leave = useCallback(async () => {
    await emitAck("room:leave", {});
    clearSession(code);
    setJoined(false);
  }, [code, emitAck]);

  const sendCommand = useCallback(
    async (command: GameCommand, success?: string): Promise<{ ok: true } | { ok: false; message: string }> => {
      const commandId = newCommandId();
      // Retry once with the SAME command id: the server dedupes, so this can never double-apply.
      let ack = await emitAck("game:command", { commandId, command });
      if (!ack.ok && ack.code === "INTERNAL" && socket.connected) ack = await emitAck("game:command", { commandId, command });
      if (ack.ok) {
        if (success) toast("ok", success);
        return { ok: true };
      }
      toast("error", ack.message);
      return { ok: false, message: ack.message };
    },
    [emitAck, socket, toast],
  );
  const send = useCallback(async (command: GameCommand, success?: string) => (await sendCommand(command, success)).ok, [sendCommand]);

  const value: GameContextValue = {
    code,
    status,
    joined,
    checked,
    joining,
    joinError,
    kicked,
    lobby,
    view,
    chat,
    toasts,
    clockOffset,
    playerId,
    join,
    leave,
    emitAck: emitAck as GameContextValue["emitAck"],
    send,
    sendCommand,
    toast,
  };
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

/** Re-renders every `ms` so countdowns and party positions animate smoothly. */
export function useNow(ms = 250, offset = 0): number {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset), ms);
    return () => clearInterval(id);
  }, [ms, offset]);
  return now;
}
