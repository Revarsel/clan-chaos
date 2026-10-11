"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLAN_LIST, CLANS } from "@clan-chaos/game-content";
import type { ClanId } from "@clan-chaos/shared";
import { useGame } from "@/hooks/useGame";
import { Logo } from "./Logo";
import { ChatPanel } from "./game/ChatPanel";
import { ConnectionBadge } from "./ConnectionBadge";

export function Lobby() {
  const { lobby, playerId, emitAck, toast, leave } = useGame();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  if (!lobby) return null;
  const me = lobby.players.find((p) => p.id === playerId);
  const isHost = lobby.hostId === playerId;

  const act = async (event: Parameters<typeof emitAck>[0], payload: unknown) => {
    const ack = await emitAck(event, payload);
    if (!ack.ok) toast("error", ack.message);
  };

  const copy = async () => {
    const link = `${window.location.origin}/room/${lobby.code}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* clipboard can be unavailable over plain http on LAN */
      window.prompt("Copy the room link:", link);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-4 px-4 py-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Logo small />
        <ConnectionBadge />
      </header>

      <section className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="panel-title">Room code</div>
          <div className="font-display text-4xl font-black tracking-[0.25em] text-bark-900">{lobby.code}</div>
          <div className="text-xs text-bark-600">Friends on the same Wi-Fi can open this page and enter the code.</div>
        </div>
        <div className="flex gap-2">
          <button className="btn-plain" onClick={copy}>
            {copied ? "Copied!" : "📋 Copy link"}
          </button>
          <button
            className="btn-plain"
            onClick={async () => {
              await leave();
              router.push("/");
            }}
          >
            Leave
          </button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="panel-title">
              Clans ({lobby.players.length}/{lobby.maxPlayers})
            </h2>
            {lobby.status === "finished" && <span className="chip">Previous match finished</span>}
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {lobby.players.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border-2 bg-parchment-50 p-2" style={{ borderColor: p.color }}>
                <span className="grid h-10 w-10 place-items-center rounded-full text-2xl" style={{ background: `${p.color}33` }}>
                  {CLANS[p.clan].emblem}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display font-bold">
                    {p.name} {p.id === playerId && <span className="text-xs text-bark-500">(you)</span>}
                    {p.isHost && <span title="Host"> 👑</span>}
                  </div>
                  <div className="truncate text-xs text-bark-600">{CLANS[p.clan].name}</div>
                </div>
                {!p.connected ? (
                  <span className="chip text-bark-500">offline</span>
                ) : p.ready ? (
                  <span className="chip border-moss-600 bg-moss-300">Ready</span>
                ) : (
                  <span className="chip">Waiting</span>
                )}
                {isHost && p.id !== playerId && (
                  <button className="text-xs text-ember-600 underline" onClick={() => act("lobby:kick", { playerId: p.id })}>
                    remove
                  </button>
                )}
              </li>
            ))}
          </ul>

          {me && (
            <>
              <h3 className="panel-title mb-2 mt-5">Choose your clan</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {CLAN_LIST.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => act("lobby:selectClan", { clan: c.id as ClanId })}
                    className={`rounded-xl border-2 p-3 text-left transition ${
                      me.clan === c.id ? "border-royal-500 bg-royal-400/15 shadow-pop" : "border-bark-700/30 bg-parchment-50 hover:border-bark-700"
                    }`}
                  >
                    <div className="font-display font-bold">
                      {c.emblem} {c.name}
                    </div>
                    <div className="text-xs font-semibold text-royal-600">{c.abilityName}</div>
                    <div className="text-xs text-bark-700">{c.abilityText}</div>
                    <div className="mt-1 text-[11px] italic text-bark-500">{c.flavor}</div>
                  </button>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button className={me.ready ? "btn-plain" : "btn-green"} onClick={() => act("lobby:setReady", { ready: !me.ready })}>
                  {me.ready ? "Not ready" : "✔ I'm ready"}
                </button>
                {isHost ? (
                  <button className="btn-primary px-6 py-2.5 text-base" disabled={!lobby.canStart} onClick={() => act("lobby:start", {})}>
                    ⚔️ Start match
                  </button>
                ) : (
                  <span className="text-sm text-bark-600">Waiting for the host to start…</span>
                )}
              </div>
              {lobby.startBlockers.length > 0 && (
                <ul className="mt-2 text-xs text-bark-600">
                  {lobby.startBlockers.map((b) => (
                    <li key={b}>• {b}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
        <ChatPanel className="h-80 lg:h-auto" />
      </div>
    </main>
  );
}
