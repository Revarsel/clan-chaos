"use client";

const key = (code: string) => `clanchaos:session:${code.toUpperCase()}`;

export interface StoredSession {
  playerId: string;
  token: string;
  name: string;
}

export function loadSession(code: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(key(code));
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(code: string, s: StoredSession): void {
  try {
    localStorage.setItem(key(code), JSON.stringify(s));
    localStorage.setItem("clanchaos:name", s.name);
  } catch {
    /* storage unavailable: session will not survive reloads */
  }
}

export function clearSession(code: string): void {
  try {
    localStorage.removeItem(key(code));
  } catch {
    /* ignore */
  }
}

export function lastName(): string {
  try {
    return localStorage.getItem("clanchaos:name") ?? "";
  } catch {
    return "";
  }
}

export function newCommandId(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
