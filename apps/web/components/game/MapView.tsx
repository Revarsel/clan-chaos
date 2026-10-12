"use client";
import { memo } from "react";
import type { PartyView, PlayerView } from "@clan-chaos/shared";
import { CLANS, MAP_HEIGHT, MAP_LOCATIONS, MAP_WIDTH, STRONGHOLD_SLOTS, type MapLocation } from "@clan-chaos/game-content";

interface Props {
  view: PlayerView;
  now: number;
  selectedLocation: string | null;
  selectedPlayer: string | null;
  selectedParty: string | null;
  onSelectLocation: (id: string) => void;
  onSelectPlayer: (id: string) => void;
  onSelectParty: (id: string) => void;
  /** Enlarges labels and markers on small screens. */
  labelScale?: number;
}

const RESOURCE_BADGE = { gold: "🪙", materials: "🪵", food: "🍖", mixed: "🎲" } as const;
const STOCK_TEXT = { rich: "Rich", steady: "Steady", poor: "Low", empty: "Empty" } as const;

/** Keyboard + screen-reader support for clickable SVG groups. */
const interactive = (label: string, onActivate: () => void) => ({
  role: "button",
  tabIndex: 0,
  "aria-label": label,
  onClick: onActivate,
  onKeyDown: (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  },
  className: "cursor-pointer outline-none [&:focus-visible>.focus-halo]:opacity-100",
});

function partyPos(p: PartyView, now: number) {
  if (p.status !== "traveling" && p.status !== "returning") return p.to;
  const span = p.arriveAt - p.departAt;
  const t = span <= 0 ? 1 : Math.min(1, Math.max(0, (now - p.departAt) / span));
  return { x: p.from.x + (p.to.x - p.from.x) * t, y: p.from.y + (p.to.y - p.from.y) * t };
}

const MOUNTAINS: [number, number, number][] = [
  [560, 70, 70],
  [700, 60, 60],
  [760, 110, 45],
  [230, 140, 45],
  [360, 110, 40],
];

const Terrain = memo(function Terrain() {
  return (
    <g>
      <defs>
        <radialGradient id="grass" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#a6d67a" />
          <stop offset="70%" stopColor="#7cb85a" />
          <stop offset="100%" stopColor="#5b9440" />
        </radialGradient>
        <pattern id="tuft" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M10 30 q3 -8 6 0 M14 30 q2 -6 4 0" stroke="#5f9a43" strokeWidth="2" fill="none" opacity="0.6" />
          <path d="M42 50 q3 -8 6 0" stroke="#5f9a43" strokeWidth="2" fill="none" opacity="0.5" />
        </pattern>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#28180c" floodOpacity="0.35" />
        </filter>
      </defs>
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} rx="28" fill="url(#grass)" />
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} rx="28" fill="url(#tuft)" />
      {/* river */}
      <path
        d="M-10 250 C 120 230, 220 300, 330 330 S 520 420, 600 480 S 760 640, 1010 620"
        stroke="#5fb4e6"
        strokeWidth="34"
        fill="none"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M-10 250 C 120 230, 220 300, 330 330 S 520 420, 600 480 S 760 640, 1010 620"
        stroke="#bfe6ff"
        strokeWidth="6"
        strokeDasharray="20 26"
        fill="none"
        opacity="0.8"
      />
      {/* dirt roads */}
      <g stroke="#d9b46a" strokeWidth="10" fill="none" strokeLinecap="round" opacity="0.75">
        <path d="M90 90 Q 300 120 470 300 T 910 610" />
        <path d="M910 90 Q 700 200 560 420 T 90 610" />
        <path d="M500 60 L 470 300 L 500 650" />
        <path d="M50 300 Q 300 330 560 420 T 950 360" />
      </g>
      {/* mountains (north) */}
      <g filter="url(#soft)">
        {MOUNTAINS.map(([x, y, s], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path d={`M${-s} ${s * 0.6} L0 ${-s * 0.7} L${s} ${s * 0.6} Z`} fill="#9a8f86" stroke="#3d2514" strokeWidth="3" strokeLinejoin="round" />
            <path d={`M${-s * 0.32} ${-s * 0.25} L0 ${-s * 0.7} L${s * 0.32} ${-s * 0.25} L${s * 0.1} ${-s * 0.15} L0 ${-s * 0.3} Z`} fill="#fff" />
          </g>
        ))}
      </g>
      {/* scattered trees */}
      {[
        [150, 380], [230, 470], [120, 500], [260, 400], [850, 280], [880, 390], [760, 300], [820, 430],
        [380, 650], [620, 650], [330, 250], [950, 470], [40, 420], [680, 250],
      ].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`} filter="url(#soft)">
          <rect x="-3" y="4" width="6" height="12" fill="#6e4527" />
          <circle r="14" fill={i % 3 ? "#3f8a3a" : "#4f9e44"} stroke="#24461c" strokeWidth="2.5" />
        </g>
      ))}
    </g>
  );
});

function LocationArt({ loc }: { loc: MapLocation }) {
  switch (loc.kind) {
    case "gold_mine":
      return (
        <g>
          <path d="M-34 22 L-20 -18 L0 -30 L22 -14 L34 22 Z" fill="#8b7d70" stroke="#3d2514" strokeWidth="3" />
          <path d="M-12 22 v-16 a12 12 0 0 1 24 0 v16 z" fill="#28180c" />
          <circle cx="-16" cy="-4" r="4" fill="#ffd24d" />
          <circle cx="14" cy="-10" r="3.5" fill="#ffd24d" />
          <circle cx="20" cy="8" r="3" fill="#ffe38a" />
        </g>
      );
    case "forest":
      return (
        <g>
          {[
            [-20, 6], [0, -8], [20, 6], [-8, 16], [12, 18],
          ].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <path d="M0 -24 L14 6 L-14 6 Z" fill={i % 2 ? "#2f7a3a" : "#3c8f45"} stroke="#1d3d17" strokeWidth="2.5" strokeLinejoin="round" />
              <rect x="-2.5" y="6" width="5" height="7" fill="#6e4527" />
            </g>
          ))}
        </g>
      );
    case "farm":
      return (
        <g>
          <rect x="-36" y="-6" width="72" height="34" rx="6" fill="#e9c46a" stroke="#3d2514" strokeWidth="3" />
          {[-24, -10, 4, 18].map((x) => (
            <path key={x} d={`M${x} -2 v26`} stroke="#c58f2a" strokeWidth="4" />
          ))}
          <path d="M-14 -6 L-14 -24 L0 -34 L14 -24 L14 -6 Z" fill="#d1495b" stroke="#3d2514" strokeWidth="3" />
          <rect x="-4" y="-18" width="8" height="12" fill="#3d2514" />
        </g>
      );
    case "ruins":
      return (
        <g>
          <rect x="-36" y="14" width="72" height="12" rx="3" fill="#cfc6b8" stroke="#3d2514" strokeWidth="3" />
          {[-26, -8, 10, 26].map((x, i) => (
            <rect key={x} x={x - 5} y={-20 + (i % 2) * 12} width="10" height={34 - (i % 2) * 12} fill="#e6dfd3" stroke="#3d2514" strokeWidth="2.5" />
          ))}
          <path d="M-32 -22 h36" stroke="#3d2514" strokeWidth="6" strokeLinecap="round" />
          <circle cx="0" cy="2" r="5" fill="#8f7cf7" stroke="#3d2514" strokeWidth="2" />
        </g>
      );
    case "trading_post":
      return (
        <g>
          <path d="M-34 18 L0 -28 L34 18 Z" fill="#f26a2e" stroke="#3d2514" strokeWidth="3" strokeLinejoin="round" />
          <path d="M-17 18 L0 -28 L17 18" fill="#ffd24d" stroke="#3d2514" strokeWidth="2" />
          <path d="M0 -28 v-12 l12 4 l-12 4" fill="#2e86de" stroke="#3d2514" strokeWidth="2" />
          <rect x="-8" y="2" width="16" height="16" fill="#3d2514" />
        </g>
      );
  }
}

function Castle({ color, fort, exposed }: { color: string; fort: number; exposed: boolean }) {
  return (
    <g filter="url(#soft)">
      <path
        d="M-30 26 V-6 h8 v-8 h8 v8 h8 v-16 l8 -10 l8 10 v16 h8 v-8 h8 v8 h8 V26 Z"
        fill={exposed ? "#9a8f86" : "#e8dcc6"}
        stroke="#3d2514"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M2 -32 v-14 l14 5 l-14 5" fill={color} stroke="#3d2514" strokeWidth="2" />
      <rect x="-7" y="8" width="14" height="18" rx="7" fill="#3d2514" />
      <rect x="-20" y="2" width="6" height="8" rx="2" fill="#3d2514" />
      <rect x="14" y="2" width="6" height="8" rx="2" fill="#3d2514" />
      <g transform="translate(0 40)">
        <rect x="-20" y="-9" width="40" height="18" rx="9" fill={color} stroke="#3d2514" strokeWidth="2" />
        <text textAnchor="middle" y="5" fontSize="13" fontWeight="800" fill="#fff">
          🛡{fort}
        </text>
      </g>
    </g>
  );
}

export function MapView({
  view,
  now,
  selectedLocation,
  selectedPlayer,
  selectedParty,
  onSelectLocation,
  onSelectPlayer,
  onSelectParty,
  labelScale = 1,
}: Props) {
  const players = new Map(view.players.map((p) => [p.id, p]));
  const locView = new Map(view.locations.map((l) => [l.id, l]));
  const stockColor = { rich: "#3bb273", steady: "#f2a541", poor: "#e4572e", empty: "#6b6b6b" };
  const fs = 13 * labelScale;
  const idleByOwner = new Map<string, number>();
  for (const p of view.parties) if (p.status === "idle") idleByOwner.set(p.ownerId, (idleByOwner.get(p.ownerId) ?? 0) + 1);
  const selParty = view.parties.find((p) => p.id === selectedParty);
  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      className="h-full w-full touch-manipulation select-none"
      role="group"
      aria-label="Map. Locations and strongholds are buttons."
    >
      <Terrain />
      {selParty && selParty.status !== "idle" && (
        <line x1={selParty.from.x} y1={selParty.from.y} x2={selParty.to.x} y2={selParty.to.y} stroke="#6c56e6" strokeWidth="6" strokeDasharray="4 10" strokeLinecap="round" />
      )}
      {MAP_LOCATIONS.map((loc) => {
        const lv = locView.get(loc.id);
        const selected = selectedLocation === loc.id;
        const kindWord = loc.resource ? `${loc.resource === "mixed" ? "random resource" : loc.resource} site, ${loc.safe ? "safe" : "contested"}` : "market";
        const stock = lv ? `, stock ${lv.exactStock ?? STOCK_TEXT[lv.stockLevel]}` : "";
        const label = `${loc.resource ? RESOURCE_BADGE[loc.resource] + " " : "⛺ "}${loc.name}`;
        const w = label.length * 7.4 * labelScale + 22;
        return (
          <g
            key={loc.id}
            data-tour={`loc-${loc.id}`}
            transform={`translate(${loc.position.x} ${loc.position.y})`}
            {...interactive(`${loc.name}: ${kindWord}${stock}`, () => onSelectLocation(loc.id))}
          >
            <circle r="62" fill="transparent" />
            <circle className="focus-halo" r="58" fill="none" stroke="#6c56e6" strokeWidth="5" opacity="0" />
            {selected && <circle r="56" fill="#fff" opacity="0.35" stroke="#6c56e6" strokeWidth="4" strokeDasharray="8 6" />}
            {!loc.safe && loc.resource && <circle r="48" fill="none" stroke="#f26a2e" strokeWidth="3" strokeDasharray="4 7" opacity="0.8" />}
            <g filter="url(#soft)">
              <LocationArt loc={loc} />
            </g>
            <g transform={`translate(0 ${40 + 6 * labelScale})`}>
              <rect x={-w / 2} y={-11 * labelScale} width={w} height={22 * labelScale} rx={11 * labelScale} fill="#fbf1dc" stroke="#3d2514" strokeWidth="2" />
              <text textAnchor="middle" y={5 * labelScale} fontSize={fs} fontWeight="800" fill="#3d2514">
                {label}
              </text>
            </g>
            {loc.resource && (
              <g transform={`translate(${-40} -34)`}>
                <title>{loc.safe ? "Safe site: cannot be ambushed" : "Contested site: parties here can be ambushed"}</title>
                <circle r={11 * Math.min(labelScale, 1.4)} fill={loc.safe ? "#3bb273" : "#f26a2e"} stroke="#3d2514" strokeWidth="2" />
                <text textAnchor="middle" y={4.5 * Math.min(labelScale, 1.4)} fontSize={12 * Math.min(labelScale, 1.4)}>
                  {loc.safe ? "🛡" : "⚔"}
                </text>
              </g>
            )}
            {lv && (
              <g transform="translate(40 -34)">
                <title>{`Stock: ${lv.exactStock ?? STOCK_TEXT[lv.stockLevel]}`}</title>
                <rect x={-22 * Math.min(labelScale, 1.4)} y={-10 * Math.min(labelScale, 1.4)} width={44 * Math.min(labelScale, 1.4)} height={20 * Math.min(labelScale, 1.4)} rx="8" fill={stockColor[lv.stockLevel]} stroke="#3d2514" strokeWidth="2" />
                <text textAnchor="middle" y={4 * Math.min(labelScale, 1.4)} fontSize={11 * Math.min(labelScale, 1.4)} fontWeight="800" fill="#fff">
                  {lv.exactStock ?? STOCK_TEXT[lv.stockLevel]}
                </text>
              </g>
            )}
          </g>
        );
      })}
      {view.players.map((p) => {
        const pos = STRONGHOLD_SLOTS[p.seat]!;
        const selected = selectedPlayer === p.id;
        const you = p.id === view.youId;
        const idle = idleByOwner.get(p.id) ?? 0;
        return (
          <g
            key={p.id}
            data-tour={you ? "my-castle" : `castle-${p.id}`}
            transform={`translate(${pos.x} ${pos.y})`}
            opacity={p.eliminated ? 0.45 : 1}
            {...interactive(
              `${you ? "Your stronghold" : `${p.name}'s stronghold`}: fort ${p.fortDefense}${p.hasBarricade ? ", barricaded" : ""}${p.eliminated ? ", eliminated" : ""}`,
              () => onSelectPlayer(p.id),
            )}
          >
            <circle r="64" fill="transparent" />
            <circle className="focus-halo" r="60" fill="none" stroke="#6c56e6" strokeWidth="5" opacity="0" />
            {selected && <circle r="58" fill="#fff" opacity="0.3" stroke="#6c56e6" strokeWidth="4" strokeDasharray="8 6" />}
            {you && <circle r="50" fill={p.color} opacity="0.3" />}
            <Castle color={p.color} fort={p.fortDefense} exposed={p.fortDefense === 0} />
            {p.hasBarricade && (
              <text x="-40" y="24" fontSize="18">
                🧱
              </text>
            )}
            <g transform="translate(0 -60)">
              <text textAnchor="middle" fontSize={14 * Math.min(labelScale, 1.5)} fontWeight="900" fill="#fff" stroke="#3d2514" strokeWidth="4" paintOrder="stroke">
                {you ? "★ YOU" : `${CLANS[p.clan].emblem} ${p.name}`}
                {p.eliminated ? " ☠" : !p.connected ? " 💤" : ""}
              </text>
            </g>
            {you && idle > 0 && (
              <g transform="translate(-34 -26)">
                <title>{`${idle} idle part${idle === 1 ? "y" : "ies"} at home`}</title>
                <rect x="-22" y="-12" width="44" height="24" rx="12" fill="#fbf1dc" stroke="#3d2514" strokeWidth="2" />
                <text textAnchor="middle" y="5" fontSize="13" fontWeight="800" fill="#3d2514">
                  👣×{idle}
                </text>
              </g>
            )}
            {p.hasCommittedRaid && view.phase === "scheme" && (
              <g transform="translate(34 -26)">
                <title>Raid order submitted (target hidden)</title>
                <circle r="12" fill="#f26a2e" stroke="#3d2514" strokeWidth="2" className="animate-pulse" />
                <text textAnchor="middle" y="5" fontSize="13">
                  ⚔
                </text>
              </g>
            )}
          </g>
        );
      })}
      {view.parties
        .filter((p) => p.status !== "idle")
        .map((p) => {
          const owner = players.get(p.ownerId);
          const pos = partyPos(p, now);
          const mine = p.ownerId === view.youId;
          const sel = p.id === selectedParty;
          const r = 11 * Math.min(labelScale, 1.6);
          const marker = (
            <g transform={`translate(${pos.x + (mine ? -14 : 14)} ${pos.y - 20})`}>
              {sel && <circle r={r + 8} fill="none" stroke="#6c56e6" strokeWidth="4" />}
              {p.status === "intercepted" && <circle r={r + 7} fill="#f26a2e" opacity="0.5" className="animate-ping" />}
              <circle r={r} fill={owner?.color ?? "#999"} stroke="#3d2514" strokeWidth="2.5" />
              <text textAnchor="middle" y={r * 0.4} fontSize={r * 1.1}>
                {p.status === "gathering" ? "⛏" : p.status === "returning" ? "🎒" : p.status === "intercepted" ? "💥" : "👣"}
              </text>
            </g>
          );
          return (
            <g key={p.id}>
              {(p.status === "traveling" || p.status === "returning") && (
                <line x1={p.from.x} y1={p.from.y} x2={p.to.x} y2={p.to.y} stroke={owner?.color} strokeWidth="2.5" strokeDasharray="6 8" opacity="0.6" />
              )}
              {mine ? <g {...interactive(`Your party: ${p.status}`, () => onSelectParty(p.id))}><circle cx={pos.x - 14} cy={pos.y - 20} r={r + 10} fill="transparent" />{marker}</g> : marker}
            </g>
          );
        })}
    </svg>
  );
}

/** Explains the map symbols. */
export function MapLegend() {
  const items: [string, string][] = [
    ["🛡", "Safe site: can't be ambushed"],
    ["⚔", "Contested site: more yield, ambush risk"],
    ["Rich / Steady / Low", "Stock left at a site"],
    ["👣 🎒 ⛏", "Party walking / returning / gathering"],
    ["💥", "Party ambushed"],
    ["★ YOU", "Your stronghold"],
    ["🛡5", "Fort defense"],
    ["🧱", "Has a barricade (size secret)"],
    ["⚔ on a castle", "Raid order submitted (target secret)"],
  ];
  return (
    <details className="rounded-xl border border-bark-700/30 bg-parchment-50 px-2 py-1 text-xs">
      <summary className="focus-ring cursor-pointer font-bold">Map legend</summary>
      <ul className="mt-1 grid gap-0.5 sm:grid-cols-2">
        {items.map(([k, v]) => (
          <li key={k}>
            <b>{k}</b> — {v}
          </li>
        ))}
      </ul>
    </details>
  );
}
