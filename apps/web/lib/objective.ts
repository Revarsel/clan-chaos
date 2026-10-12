import type { PlayerView } from "@clan-chaos/shared";
import { ACTION_VALUES } from "@clan-chaos/game-content";

/** Optional, state-based suggestions. They never act for the player. */
export interface Objective {
  id: string;
  text: string;
  tone: "urgent" | "normal" | "info";
  /** Where the player can do it, if anywhere. */
  goTo?: "actions" | "cards" | "raid" | "map" | "feed" | "players";
  done?: boolean;
}

export function objectives(view: PlayerView, now: number): Objective[] {
  const self = view.self;
  const me = view.players.find((p) => p.id === view.youId);
  if (view.phase === "ended") return [{ id: "ended", text: "The match is over. See the final standings.", tone: "info" }];
  if (!self || me?.eliminated) return [{ id: "spectate", text: "You are spectating. Follow the raids and standings.", tone: "info", goTo: "feed" }];
  const secs = Math.max(0, Math.ceil((view.phaseEndsAt - now) / 1000));
  const out: Objective[] = [];
  const rivals = view.players.filter((p) => p.id !== view.youId && !p.eliminated);
  const idle = view.parties.filter((p) => p.ownerId === view.youId && p.status === "idle").length;

  if (view.phase === "resolution") {
    out.push({ id: "review", text: "Raids are being revealed. Check what happened to you.", tone: "info", goTo: "feed" });
    if (self.resources.food < ACTION_VALUES.upkeepFood && !self.effects.some((e) => e.startsWith("Emergency Rations"))) {
      out.push({
        id: "upkeep",
        text: self.resources.gold > 0 ? "No food: upkeep will take 1 gold at the end of this round." : "No food or gold for upkeep this round.",
        tone: "urgent",
      });
    }
    return out;
  }
  if (view.phase === "scheme" && rivals.length) {
    out.push(
      self.raid
        ? { id: "raid", text: "Raid order submitted and hidden. It resolves when the timer ends.", tone: "info", goTo: "raid", done: true }
        : { id: "raid", text: `Submit a secret raid before orders lock in ${secs}s (optional).`, tone: "urgent", goTo: "raid" },
    );
  }
  if (idle > 0) out.push({ id: "gather", text: `${idle} gathering ${idle === 1 ? "party is" : "parties are"} idle. Send ${idle === 1 ? "it" : "them"} to a site.`, tone: "normal", goTo: "map" });
  if (self.fortDefense === 0) out.push({ id: "fort", text: "Your fort is exposed (0 defense). Repair it or build a barricade.", tone: "urgent", goTo: "actions" });
  if (self.resources.food < ACTION_VALUES.upkeepFood) out.push({ id: "food", text: "You have no food for upkeep. Gather food or trade for it.", tone: "urgent", goTo: "map" });
  if (view.phase === "build") out.push({ id: "prepare", text: `Prepare: build, buy or play cards, defend. Raid orders open in ${secs}s.`, tone: "normal", goTo: "actions" });
  if (view.trades.some((t) => t.toId === view.youId && t.status === "open") || view.truceOffer) {
    out.push({ id: "offers", text: "Someone sent you an offer. Review it in Trade.", tone: "normal", goTo: "players" });
  }
  return out.slice(0, 3);
}
