"use client";
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@clan-chaos/shared";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

/** The game server lives on port 4000 of the same host the page was loaded from (works on LAN). */
export function serverUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SERVER_URL;
  if (configured) return configured;
  if (typeof window === "undefined") return "http://localhost:4000";
  return `${window.location.protocol}//${window.location.hostname}:4000`;
}

export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(serverUrl(), { transports: ["websocket", "polling"], reconnectionDelayMax: 4000 });
  }
  return socket;
}
