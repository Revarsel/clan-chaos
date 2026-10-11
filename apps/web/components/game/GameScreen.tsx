"use client";
import { useState } from "react";
import type { RaidTarget } from "@clan-chaos/shared";
import { useGame, useNow } from "@/hooks/useGame";
import { ConnectionBadge } from "../ConnectionBadge";
import { MapView } from "./MapView";
import { PhaseTimer } from "./PhaseTimer";
import { ResourceHud } from "./ResourceHud";
import { SelectionPanel } from "./SelectionPanel";
import { ActionsPanel } from "./ActionsPanel";
import { HandPanel } from "./HandPanel";
import { RaidPanel } from "./RaidPanel";
import { TradePanel } from "./TradePanel";
import { ChatPanel } from "./ChatPanel";
import { Scoreboard } from "./Scoreboard";
import { IntelPanel } from "./IntelPanel";
import { EventBanner } from "./EventBanner";
import { ResolutionOverlay } from "./ResolutionOverlay";

type Tab = "build" | "cards" | "raid" | "trade" | "chat" | "intel" | "score";

const TABS: { id: Tab; label: string; icon: string; spectator: boolean }[] = [
  { id: "build", label: "Build", icon: "🔨", spectator: false },
  { id: "cards", label: "Cards", icon: "🃏", spectator: false },
  { id: "raid", label: "Raid", icon: "⚔️", spectator: false },
  { id: "trade", label: "Trade", icon: "🤝", spectator: false },
  { id: "chat", label: "Chat", icon: "💬", spectator: true },
  { id: "intel", label: "Intel", icon: "🔭", spectator: true },
  { id: "score", label: "Score", icon: "⭐", spectator: true },
];

export function GameScreen() {
  const { view, clockOffset, chat } = useGame();
  const now = useNow(200, clockOffset);
  const [tab, setTab] = useState<Tab>("build");
  const [selLoc, setSelLoc] = useState<string | null>(null);
  const [selPlayer, setSelPlayer] = useState<string | null>(null);
  const [raidHint, setRaidHint] = useState<RaidTarget | null>(null);
  const [tradePartner, setTradePartner] = useState<string | null>(null);
  const [seenChat, setSeenChat] = useState(0);
  if (!view) return null;

  const me = view.players.find((p) => p.id === view.youId);
  const spectating = !view.self || !!me?.eliminated;
  const tabs = TABS.filter((t) => !spectating || t.spectator);
  const activeTab: Tab = tabs.some((t) => t.id === tab) ? tab : "score";
  const unreadChat = activeTab === "chat" ? 0 : Math.max(0, chat.length - seenChat);
  const pendingTrades = view.trades.filter((t) => t.toId === view.youId && t.status === "open").length + (view.truceOffer ? 1 : 0);

  const choose = (t: Tab) => {
    setTab(t);
    if (t === "chat") setSeenChat(chat.length);
  };

  const panel = (() => {
    switch (activeTab) {
      case "build":
        return <ActionsPanel view={view} />;
      case "cards":
        return <HandPanel view={view} />;
      case "raid":
        return <RaidPanel view={view} hint={raidHint} />;
      case "trade":
        return <TradePanel view={view} partner={tradePartner} />;
      case "chat":
        return <ChatPanel className="h-[420px] border-0 bg-transparent p-0 shadow-none" />;
      case "intel":
        return <IntelPanel view={view} />;
      case "score":
        return <Scoreboard view={view} onSelect={(id) => (setSelPlayer(id), setSelLoc(null))} />;
    }
  })();

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1500px] flex-col gap-2 p-2 md:p-3">
      <header className="flex flex-wrap items-center gap-2">
        <PhaseTimer view={view} now={now} />
        <ConnectionBadge />
      </header>
      {spectating ? (
        <div className="rounded-xl border-2 border-bark-800 bg-bark-800 px-3 py-2 text-center font-display text-parchment-100">
          ☠ Your clan has fallen. You are spectating until the match ends.
        </div>
      ) : (
        <ResourceHud view={view} />
      )}
      <EventBanner view={view} />

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-h-0 flex-col gap-2">
          <div className="panel relative overflow-hidden p-1">
            <div className="aspect-[10/7] w-full">
              <MapView
                view={view}
                now={now}
                selectedLocation={selLoc}
                selectedPlayer={selPlayer}
                onSelectLocation={(id) => {
                  setSelLoc(id);
                  setSelPlayer(null);
                }}
                onSelectPlayer={(id) => {
                  setSelPlayer(id);
                  setSelLoc(null);
                }}
              />
            </div>
            {view.phase === "scheme" && (
              <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-ember-500 px-2 py-1 font-display text-xs font-bold text-white shadow-pop">
                Scheme: commit raids before the timer ends!
              </div>
            )}
          </div>
          <SelectionPanel
            view={view}
            now={now}
            locationId={selLoc}
            playerId={selPlayer}
            onClose={() => {
              setSelLoc(null);
              setSelPlayer(null);
            }}
            onPlanRaid={(t) => {
              setRaidHint(t);
              choose("raid");
            }}
            onTrade={(id) => {
              setTradePartner(id);
              choose("trade");
            }}
          />
          <section className="panel hidden p-3 lg:block">
            <h2 className="panel-title mb-2">⭐ Scoreboard</h2>
            <Scoreboard view={view} onSelect={(id) => (setSelPlayer(id), setSelLoc(null))} />
          </section>
        </div>

        <aside className="panel flex min-h-0 flex-col">
          <nav className="flex overflow-x-auto border-b-2 border-bark-700/30">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => choose(t.id)}
                className={`relative flex-1 whitespace-nowrap px-2 py-2 font-display text-xs font-bold sm:text-sm ${
                  activeTab === t.id ? "bg-parchment-50 text-bark-900" : "text-bark-600 hover:bg-parchment-50/60"
                }`}
              >
                <span className="block text-base sm:inline sm:text-sm">{t.icon}</span> {t.label}
                {t.id === "chat" && unreadChat > 0 && (
                  <span className="absolute right-1 top-1 rounded-full bg-ember-500 px-1.5 text-[10px] text-white">{unreadChat}</span>
                )}
                {t.id === "trade" && pendingTrades > 0 && (
                  <span className="absolute right-1 top-1 rounded-full bg-ember-500 px-1.5 text-[10px] text-white">{pendingTrades}</span>
                )}
                {t.id === "raid" && view.phase === "scheme" && !view.self?.raid && (
                  <span className="absolute right-1 top-1 h-2.5 w-2.5 animate-ping rounded-full bg-ember-500" />
                )}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">{panel}</div>
        </aside>
      </div>
      <ResolutionOverlay view={view} />
    </div>
  );
}
