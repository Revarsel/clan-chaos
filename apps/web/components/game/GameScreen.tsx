"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CardInstance, PlayerView, RaidTarget } from "@clan-chaos/shared";
import { CARDS } from "@clan-chaos/game-content";
import { useGame, useNow } from "@/hooks/useGame";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { emptyDraft, sanitizeDraft, type RaidDraft } from "@/lib/raidPlan";
import { feedItems, isNotable, toastText } from "@/lib/feed";
import { formatSeconds } from "@/lib/phaseInfo";
import type { Objective } from "@/lib/objective";
import { ConnectionBadge } from "../ConnectionBadge";
import { MapLegend, MapView } from "./MapView";
import { PhaseBanner } from "./PhaseBanner";
import { ObjectiveStrip } from "./ObjectiveStrip";
import { ResourceHud } from "./ResourceHud";
import { PartiesStrip } from "./PartiesStrip";
import { SelectionPanel } from "./SelectionPanel";
import { ActionsPanel } from "./ActionsPanel";
import { HandPanel } from "./HandPanel";
import { RaidPanel } from "./RaidPanel";
import { TradePanel } from "./TradePanel";
import { ChatPanel } from "./ChatPanel";
import { FeedPanel } from "./FeedPanel";
import { PlayersPanel } from "./PlayersPanel";
import { EventBanner } from "./EventBanner";
import { ResolutionOverlay } from "./ResolutionOverlay";

type Tab = "actions" | "cards" | "raid" | "feed" | "players" | "trade" | "chat";

const TABS: { id: Tab; label: string; icon: string; spectator: boolean; primary: boolean }[] = [
  { id: "actions", label: "Actions", icon: "🔨", spectator: false, primary: true },
  { id: "cards", label: "Cards", icon: "🃏", spectator: false, primary: true },
  { id: "raid", label: "Raid", icon: "⚔️", spectator: false, primary: true },
  { id: "feed", label: "Feed", icon: "📜", spectator: true, primary: false },
  { id: "players", label: "Players", icon: "⭐", spectator: true, primary: false },
  { id: "trade", label: "Trade", icon: "🤝", spectator: false, primary: false },
  { id: "chat", label: "Chat", icon: "💬", spectator: true, primary: false },
];

/** Live notifications for new feed rows that matter to this player (deliveries, upkeep, raids, points…). */
function useFeedNotifications(view: PlayerView | null, toast: (k: "info", t: string) => void) {
  const seen = useRef<Set<string> | null>(null);
  const matchId = useRef<string | null>(null);
  useEffect(() => {
    if (!view) return;
    const items = feedItems(view);
    if (matchId.current !== view.matchId) {
      matchId.current = view.matchId;
      seen.current = null;
    }
    const prev = seen.current;
    seen.current = new Set(items.map((i) => i.key));
    if (!prev) return;
    const name = view.players.find((p) => p.id === view.youId)?.name ?? "";
    items.filter((i) => !prev.has(i.key) && isNotable(i, view.youId, name)).slice(-3).forEach((i) => toast("info", toastText(i)));
  }, [view, toast]);
}

export function GameScreen() {
  const { view, clockOffset, chat, toast, mode, getNow, practice } = useGame();
  const now = useNow(200, clockOffset, getNow);
  const isDesktop = useMediaQuery("(min-width: 1024px)", true);
  const [primaryTab, setPrimaryTab] = useState<Tab>("actions");
  const [secondaryTab, setSecondaryTab] = useState<Tab>("feed");
  const [sheetTab, setSheetTab] = useState<Tab | null>(null);
  const [selLoc, setSelLoc] = useState<string | null>(null);
  const [selPlayer, setSelPlayer] = useState<string | null>(null);
  const [selParty, setSelParty] = useState<string | null>(null);
  const [draft, setDraft] = useState<RaidDraft>(emptyDraft);
  const [tradePartner, setTradePartner] = useState<string | null>(null);
  const [seenChat, setSeenChat] = useState(0);
  const mapRef = useRef<HTMLDivElement>(null);
  const notify = useCallback((k: "info", t: string) => toast(k, t), [toast]);
  useFeedNotifications(view, notify);

  // Start every match at the top so the phase banner and resources are visible.
  useEffect(() => window.scrollTo(0, 0), []);
  // A new round clears last round's raid draft.
  const round = view?.round;
  useEffect(() => setDraft(emptyDraft()), [round]);
  // Practice tutorial: share the raid draft and open panels it asks for.
  const reportDraft = practice?.reportDraft;
  useEffect(() => reportDraft?.(draft), [draft, reportDraft]);
  const tabRequest = practice?.tabRequest;
  const openTabRef = useRef<(t: Tab) => void>(() => undefined);
  useEffect(() => {
    if (tabRequest) openTabRef.current(tabRequest.tab);
  }, [tabRequest]);

  if (!view) return null;
  const me = view.players.find((p) => p.id === view.youId);
  const spectating = !view.self || !!me?.eliminated;
  // The practice bot does not chat or trade, so those panels are hidden there.
  const tabs = TABS.filter((t) => (!spectating || t.spectator) && (mode === "live" || (t.id !== "chat" && t.id !== "trade")));

  const openTab = (t: Tab) => {
    if (t === "chat") setSeenChat(chat.length);
    if (isDesktop) {
      if (TABS.find((x) => x.id === t)?.primary) setPrimaryTab(t);
      else setSecondaryTab(t);
    } else setSheetTab(t);
  };
  openTabRef.current = openTab;
  const select = (kind: "loc" | "player" | "party", id: string) => {
    setSelLoc(kind === "loc" ? id : null);
    setSelPlayer(kind === "player" ? id : null);
    setSelParty(kind === "party" ? id : null);
    if (!isDesktop) setSheetTab(null);
  };
  const planRaid = (t: RaidTarget) => {
    setDraft((d) => sanitizeDraft(view, { ...d, target: t }));
    openTab("raid");
  };
  const addCardToRaid = (c: CardInstance) => {
    const slot = CARDS[c.cardId].slot;
    setDraft((d) => sanitizeDraft(view, slot === "support" ? { ...d, supportUid: c.uid } : { ...d, primaryUid: c.uid }));
    openTab("raid");
  };
  const goTo = (where: NonNullable<Objective["goTo"]>) => {
    if (where === "map") {
      setSheetTab(null);
      mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else openTab(where === "players" && view.trades.some((t) => t.toId === view.youId && t.status === "open") ? "trade" : where);
  };

  const unreadChat = Math.max(0, chat.length - seenChat);
  const pendingTrades = view.trades.filter((t) => t.toId === view.youId && t.status === "open").length + (view.truceOffer ? 1 : 0);
  const badge = (t: Tab) => {
    if (t === "chat" && unreadChat > 0 && sheetTab !== "chat" && secondaryTab !== "chat") return String(unreadChat);
    if (t === "trade" && pendingTrades > 0) return String(pendingTrades);
    if (t === "raid" && view.phase === "scheme" && !view.self?.raid && !spectating) return "!";
    return null;
  };

  const panel = (t: Tab) => {
    switch (t) {
      case "actions":
        return <ActionsPanel view={view} now={now} />;
      case "cards":
        return <HandPanel view={view} now={now} onUseInRaid={addCardToRaid} />;
      case "raid":
        return <RaidPanel view={view} now={now} draft={draft} setDraft={setDraft} />;
      case "feed":
        return <FeedPanel view={view} />;
      case "players":
        return <PlayersPanel view={view} onSelect={(id) => select("player", id)} />;
      case "trade":
        return <TradePanel view={view} partner={tradePartner} now={now} />;
      case "chat":
        return <ChatPanel className="h-[50dvh] border-0 bg-transparent p-0 shadow-none lg:h-[420px]" />;
    }
  };

  const tabStrip = (list: typeof TABS, active: Tab, onPick: (t: Tab) => void, label: string) => (
    <div role="tablist" aria-label={label} className="flex overflow-x-auto border-b-2 border-bark-700/30">
      {list.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onPick(t.id)}
          className={`focus-ring relative flex-1 whitespace-nowrap px-3 py-2 font-display text-sm font-bold ${active === t.id ? "bg-parchment-50 text-bark-900" : "text-bark-600 hover:bg-parchment-50/60"}`}
        >
          <span aria-hidden>{t.icon}</span> {t.label}
          {badge(t.id) && <span className="ml-1 rounded-full bg-ember-500 px-1.5 text-[10px] text-white">{badge(t.id)}</span>}
        </button>
      ))}
    </div>
  );

  const panelHost = (list: typeof TABS, active: Tab) =>
    list.map((t) => (
      <div key={t.id} role="tabpanel" hidden={active !== t.id} aria-label={t.label}>
        {panel(t.id)}
      </div>
    ));

  const primary = tabs.filter((t) => t.primary);
  const secondary = tabs.filter((t) => !t.primary);
  const activePrimary = primary.some((t) => t.id === primaryTab) ? primaryTab : (primary[0]?.id ?? "feed");
  const activeSecondary = secondary.some((t) => t.id === secondaryTab) ? secondaryTab : "feed";
  const sheetMeta = TABS.find((t) => t.id === sheetTab);

  return (
    <div className="mx-auto min-h-dvh max-w-[1500px] px-2 pb-24 md:px-3 lg:pb-6">
      <PhaseBanner view={view} now={now} compact={!isDesktop} />
      <div className="mt-2 space-y-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <ObjectiveStrip view={view} now={now} onGo={goTo} compact={!isDesktop} />
          </div>
          {mode === "live" && <ConnectionBadge />}
        </div>
        {spectating ? (
          <div className="rounded-xl border-2 border-bark-800 bg-bark-800 px-3 py-2 text-center font-display text-parchment-100">
            ☠ Your clan has fallen. You can follow the raids, feed and standings until the match ends.
          </div>
        ) : (
          <ResourceHud view={view} />
        )}
        <EventBanner view={view} />
      </div>

      <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start">
        <div className="min-w-0 space-y-2">
          <div ref={mapRef} className="panel relative overflow-hidden p-1" data-tour="map">
            <div className="aspect-[10/7] w-full">
              <MapView
                view={view}
                now={now}
                selectedLocation={selLoc}
                selectedPlayer={selPlayer}
                selectedParty={selParty}
                onSelectLocation={(id) => select("loc", id)}
                onSelectPlayer={(id) => select("player", id)}
                onSelectParty={(id) => select("party", id)}
                labelScale={isDesktop ? 1 : 1.7}
              />
            </div>
          </div>
          <MapLegend />
          <PartiesStrip view={view} now={now} selected={selParty} onSelect={(id) => select("party", id)} />
          <SelectionPanel
            view={view}
            now={now}
            locationId={selLoc}
            playerId={selPlayer}
            partyId={selParty}
            onClose={() => {
              setSelLoc(null);
              setSelPlayer(null);
              setSelParty(null);
            }}
            onPlanRaid={planRaid}
            onTrade={(id) => {
              setTradePartner(id);
              openTab("trade");
            }}
            onSelectParty={(id) => select("party", id)}
          />
          {isDesktop && (
            <section className="panel" aria-label="Feed, players, trade and chat">
              {tabStrip(secondary, activeSecondary, openTab, "Secondary panels")}
              <div className="max-h-[70vh] overflow-y-auto p-3">{panelHost(secondary, activeSecondary)}</div>
            </section>
          )}
        </div>

        {isDesktop && (
          <aside className="panel sticky top-[7.5rem] flex max-h-[calc(100dvh-8.5rem)] min-h-0 flex-col" aria-label="Actions, cards and raid">
            {tabStrip(primary, activePrimary, openTab, "Primary panels")}
            <div className="min-h-0 flex-1 overflow-y-auto p-3">{panelHost(primary, activePrimary)}</div>
          </aside>
        )}
      </div>

      {!isDesktop && (
        <>
          <div
            className={`fixed inset-x-0 bottom-14 z-30 max-h-[64dvh] overflow-y-auto rounded-t-2xl border-2 border-b-0 border-bark-800 bg-parchment-100 shadow-card transition-transform ${sheetTab ? "translate-y-0" : "pointer-events-none translate-y-[110%]"}`}
            aria-hidden={!sheetTab}
            data-mobile-sheet={sheetTab ? "open" : "closed"}
            role="region"
            aria-label={sheetMeta ? `${sheetMeta.label} panel` : undefined}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-bark-700/20 bg-parchment-100 px-3 py-1.5">
              <span className="font-display font-black">
                {sheetMeta?.icon} {sheetMeta?.label}
              </span>
              <span className="text-xs font-bold text-bark-600">
                {view.phase !== "ended" && `${formatSeconds(view.phaseEndsAt - now)} left`}
              </span>
              <button className="focus-ring rounded px-2 text-lg" aria-label="Close panel" onClick={() => setSheetTab(null)}>
                ▾
              </button>
            </div>
            <div className="p-3">{panelHost(tabs, sheetTab ?? tabs[0]!.id)}</div>
          </div>
          <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 grid border-t-2 border-bark-800 bg-parchment-100" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }} aria-label="Game panels">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => (sheetTab === t.id ? setSheetTab(null) : openTab(t.id))}
                aria-pressed={sheetTab === t.id}
                className={`focus-ring relative flex h-14 flex-col items-center justify-center text-[11px] font-bold ${sheetTab === t.id ? "bg-parchment-50 text-bark-900" : "text-bark-600"}`}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {t.icon}
                </span>
                {t.label}
                {badge(t.id) && <span className="absolute right-1 top-1 rounded-full bg-ember-500 px-1 text-[10px] text-white">{badge(t.id)}</span>}
              </button>
            ))}
          </nav>
        </>
      )}
      <ResolutionOverlay view={view} now={now} onOpenFeed={() => openTab("feed")} />
    </div>
  );
}
