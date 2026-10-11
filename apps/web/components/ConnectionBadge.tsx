"use client";
import { useGame } from "@/hooks/useGame";

export function ConnectionBadge() {
  const { status } = useGame();
  const map = {
    connected: ["bg-moss-400", "Connected"],
    connecting: ["bg-gold-400", "Connecting…"],
    reconnecting: ["bg-gold-400 animate-pulse", "Reconnecting…"],
    offline: ["bg-ember-500", "Offline"],
  } as const;
  const [color, label] = map[status];
  return (
    <span className="chip bg-parchment-50/90">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
