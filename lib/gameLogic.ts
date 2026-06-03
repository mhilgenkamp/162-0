import { Player, RosterSlot, Decade, SpinResult } from "./types";
import { ALL_PLAYERS, TEAMS, DECADES } from "./players";

export const ROSTER_TEMPLATE: Omit<RosterSlot, "player">[] = [
  { label: "C",   type: "hitter" },
  { label: "1B",  type: "hitter" },
  { label: "2B",  type: "hitter" },
  { label: "3B",  type: "hitter" },
  { label: "SS",  type: "hitter" },
  { label: "LF",  type: "hitter" },
  { label: "CF",  type: "hitter" },
  { label: "RF",  type: "hitter" },
  { label: "DH",  type: "hitter" },
  { label: "SP",  type: "pitcher" },
  { label: "SP",  type: "pitcher" },
  { label: "SP",  type: "pitcher" },
  { label: "SP",  type: "pitcher" },
  { label: "SP",  type: "pitcher" },
  { label: "RP",  type: "pitcher" },
];

const REPLACEMENT_WINS = 48;

export function calcProjectedWins(roster: RosterSlot[]): number {
  const totalWAR = roster.reduce((sum, slot) => sum + (slot.player?.war ?? 0), 0);
  return Math.min(162, Math.round(REPLACEMENT_WINS + totalWAR));
}

export function spin(): SpinResult {
  const team = TEAMS[Math.floor(Math.random() * TEAMS.length)];
  const decade = DECADES[Math.floor(Math.random() * DECADES.length)] as Decade;
  return { team, decade };
}

const HITTER_POSITIONS = new Set(["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"]);

// Returns the set of position labels that still have at least one open slot
export function getOpenPositions(roster: RosterSlot[]): Set<string> {
  return new Set(roster.filter((s) => s.player === null).map((s) => s.label));
}

// Returns only players from the exact team+decade who can fill an open slot.
// Any hitter is eligible if the DH slot is open, even if their natural position is taken.
export function getCandidates(
  result: SpinResult,
  roster: RosterSlot[],
  draftedIds: Set<string>
): Player[] {
  const open = getOpenPositions(roster);
  const dhOpen = open.has("DH");

  return ALL_PLAYERS.filter((p) => {
    if (p.team !== result.team || p.decade !== result.decade || draftedIds.has(p.id)) return false;
    if (open.has(p.position)) return true;
    // Any hitter can fill the DH slot if their natural position is taken
    if (dhOpen && HITTER_POSITIONS.has(p.position)) return true;
    return false;
  });
}

// Where would this player land given the current roster state?
export function resolveSlot(roster: RosterSlot[], player: Player): "natural" | "DH" | null {
  if (roster.find((s) => s.label === player.position && s.player === null)) return "natural";
  if (HITTER_POSITIONS.has(player.position) && roster.find((s) => s.label === "DH" && s.player === null)) return "DH";
  return null;
}

// Place a player into their natural position, or DH if that's full
export function placePlayer(roster: RosterSlot[], player: Player): RosterSlot[] {
  // Try natural position first
  let idx = roster.findIndex((s) => s.label === player.position && s.player === null);
  // Fall back to DH for any hitter
  if (idx === -1 && HITTER_POSITIONS.has(player.position)) {
    idx = roster.findIndex((s) => s.label === "DH" && s.player === null);
  }
  if (idx === -1) return roster;
  return roster.map((s, i) => (i === idx ? { ...s, player } : s));
}

export function formatWins(wins: number): string {
  return `${wins}-${162 - wins}`;
}

export function getWinColor(wins: number): string {
  if (wins >= 150) return "text-yellow-400";
  if (wins >= 130) return "text-green-400";
  if (wins >= 110) return "text-blue-400";
  if (wins >= 90)  return "text-white";
  return "text-gray-400";
}

export function formatAvg(val: number): string {
  return val.toFixed(3).replace("0.", ".");
}
