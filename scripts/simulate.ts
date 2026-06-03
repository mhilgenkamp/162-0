/**
 * Game-balance simulation for 162-0.
 *
 * Runs N drafts (random picks + greedy/optimal picks) and reports:
 *   - Win total distribution
 *   - WAR distribution by position
 *   - Team+decade pool value (avg best-WAR available)
 *   - 162-0 reachability
 *   - How often auto-reroll is needed, and how deep it goes
 */

import { Player, RosterSlot, SpinResult, Decade } from "../lib/types";
import playersJson from "../lib/players.json";

// ── Data ─────────────────────────────────────────────────────────────────────

const ALL_PLAYERS: Player[] = playersJson as Player[];
const TEAMS: string[] = [...new Set(ALL_PLAYERS.map((p) => p.team))].sort();
const DECADES: Decade[] = [
  "1920s","1930s","1940s","1950s","1960s",
  "1970s","1980s","1990s","2000s","2010s","2020s",
];

// ── Game logic (mirrored from lib/gameLogic.ts) ───────────────────────────────

const ROSTER_CONFIGS = {
  "3SP+3RP": [
    { label: "C",  type: "hitter" },
    { label: "1B", type: "hitter" },
    { label: "2B", type: "hitter" },
    { label: "3B", type: "hitter" },
    { label: "SS", type: "hitter" },
    { label: "LF", type: "hitter" },
    { label: "CF", type: "hitter" },
    { label: "RF", type: "hitter" },
    { label: "DH", type: "hitter" },
    { label: "SP", type: "pitcher" },
    { label: "SP", type: "pitcher" },
    { label: "SP", type: "pitcher" },
    { label: "RP", type: "pitcher" },
    { label: "RP", type: "pitcher" },
    { label: "RP", type: "pitcher" },
  ],
  "5SP+1RP": [
    { label: "C",  type: "hitter" },
    { label: "1B", type: "hitter" },
    { label: "2B", type: "hitter" },
    { label: "3B", type: "hitter" },
    { label: "SS", type: "hitter" },
    { label: "LF", type: "hitter" },
    { label: "CF", type: "hitter" },
    { label: "RF", type: "hitter" },
    { label: "DH", type: "hitter" },
    { label: "SP", type: "pitcher" },
    { label: "SP", type: "pitcher" },
    { label: "SP", type: "pitcher" },
    { label: "SP", type: "pitcher" },
    { label: "SP", type: "pitcher" },
    { label: "RP", type: "pitcher" },
  ],
} as const;

type ConfigName = keyof typeof ROSTER_CONFIGS;

const REPLACEMENT_WINS = 48;
const HITTER_POSITIONS = new Set(["C","1B","2B","3B","SS","LF","CF","RF","DH"]);

function freshRoster(config: ConfigName = "3SP+3RP"): RosterSlot[] {
  return (ROSTER_CONFIGS[config] as unknown as Omit<RosterSlot, "player">[]).map((t) => ({ ...t, player: null }));
}

function calcProjectedWins(roster: RosterSlot[]): number {
  const totalWAR = roster.reduce((s, slot) => s + (slot.player?.war ?? 0), 0);
  return Math.min(162, Math.round(REPLACEMENT_WINS + totalWAR));
}

function totalWAR(roster: RosterSlot[]): number {
  return roster.reduce((s, slot) => s + (slot.player?.war ?? 0), 0);
}

function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}

function spin(): SpinResult {
  return {
    team: TEAMS[randInt(TEAMS.length)],
    decade: DECADES[randInt(DECADES.length)],
  };
}

function getOpenPositions(roster: RosterSlot[]): Set<string> {
  return new Set(roster.filter((s) => s.player === null).map((s) => s.label));
}

function getCandidates(result: SpinResult, roster: RosterSlot[], draftedIds: Set<string>): Player[] {
  const open = getOpenPositions(roster);
  const dhOpen = open.has("DH");
  return ALL_PLAYERS.filter((p) => {
    if (p.team !== result.team || p.decade !== result.decade || draftedIds.has(p.id)) return false;
    if (open.has(p.position)) return true;
    if (dhOpen && HITTER_POSITIONS.has(p.position)) return true;
    return false;
  });
}

function placePlayer(roster: RosterSlot[], player: Player): RosterSlot[] {
  let idx = roster.findIndex((s) => s.label === player.position && s.player === null);
  if (idx === -1 && HITTER_POSITIONS.has(player.position)) {
    idx = roster.findIndex((s) => s.label === "DH" && s.player === null);
  }
  if (idx === -1) return roster;
  return roster.map((s, i) => (i === idx ? { ...s, player } : s));
}

function getDraftedIds(roster: RosterSlot[]): Set<string> {
  return new Set(roster.filter((s) => s.player).map((s) => s.player!.id));
}

// Spin until we get a non-empty pool; return { result, pool, attempts }
function spinUntilValid(roster: RosterSlot[], overrides?: Partial<SpinResult>): {
  result: SpinResult; pool: Player[]; attempts: number;
} {
  const draftedIds = getDraftedIds(roster);
  let result: SpinResult = { ...spin(), ...overrides };
  let pool = getCandidates(result, roster, draftedIds);
  let attempts = 0;
  while (pool.length === 0 && attempts < 50) {
    result = { ...spin(), ...overrides };
    pool = getCandidates(result, roster, draftedIds);
    attempts++;
  }
  return { result, pool, attempts };
}

// ── Simulation strategies ─────────────────────────────────────────────────────

type Strategy = "random" | "greedy";

interface DraftResult {
  wins: number;
  war: number;
}

function simulateDraft(strategy: Strategy, config: ConfigName = "3SP+3RP"): DraftResult {
  let roster = freshRoster(config);
  const rounds = ROSTER_CONFIGS[config].length;

  for (let round = 0; round < rounds; round++) {
    const { pool } = spinUntilValid(roster);
    if (pool.length === 0) break; // should never happen with 50 attempts

    const chosen = strategy === "random"
      ? pool[randInt(pool.length)]
      : pool.reduce((best, p) => (p.war > best.war ? p : best));

    roster = placePlayer(roster, chosen);
  }

  return { wins: calcProjectedWins(roster), war: totalWAR(roster) };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const N = 10_000;
const CONFIGS: ConfigName[] = ["3SP+3RP", "5SP+1RP"];

console.log(`\n${"═".repeat(70)}`);
console.log(`  162-0  Roster Config Comparison  (N = ${N.toLocaleString()} drafts per config)`);
console.log(`${"═".repeat(70)}\n`);

// 1. Run simulations for each config + strategy
const runs: Record<string, DraftResult[]> = {};

for (const cfg of CONFIGS) {
  console.log(`Running ${cfg}...`);
  const rnd: DraftResult[] = [];
  const grd: DraftResult[] = [];
  for (let i = 0; i < N; i++) {
    rnd.push(simulateDraft("random", cfg));
    grd.push(simulateDraft("greedy", cfg));
  }
  runs[`${cfg}:random`] = rnd;
  runs[`${cfg}:greedy`] = grd;
}

// 2. Side-by-side summary
function stats(results: DraftResult[]) {
  const wins = results.map((r) => r.wins).sort((a, b) => a - b);
  const wars = results.map((r) => r.war).sort((a, b) => a - b);
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const pct = (arr: number[], p: number) => arr[Math.max(0, Math.min(Math.floor(arr.length * p / 100), arr.length - 1))];
  return {
    avgWins: avg(wins),
    avgWAR: avg(wars),
    p50: pct(wins, 50),
    p90: pct(wins, 90),
    p99: pct(wins, 99),
    perfect: wins.filter((w) => w >= 162).length,
    hist116: wins.filter((w) => w >= 116).length,
    hist90: wins.filter((w) => w >= 90).length,
    best: wins[wins.length - 1],
    wins,
  };
}

function row(label: string, a: ReturnType<typeof stats>, b: ReturnType<typeof stats>) {
  const diff = (x: number, y: number, decimals = 1) => {
    const d = y - x;
    return (d >= 0 ? "+" : "") + d.toFixed(decimals);
  };
  console.log(`\n  ── ${label}`);
  console.log(`  ${"Metric".padEnd(22)} ${"3SP+3RP".padStart(10)} ${"5SP+1RP".padStart(10)} ${"Δ".padStart(8)}`);
  console.log(`  ${"─".repeat(52)}`);
  console.log(`  ${"Avg wins".padEnd(22)} ${a.avgWins.toFixed(1).padStart(10)} ${b.avgWins.toFixed(1).padStart(10)} ${diff(a.avgWins, b.avgWins).padStart(8)}`);
  console.log(`  ${"Avg total WAR".padEnd(22)} ${a.avgWAR.toFixed(1).padStart(10)} ${b.avgWAR.toFixed(1).padStart(10)} ${diff(a.avgWAR, b.avgWAR).padStart(8)}`);
  console.log(`  ${"p50 wins".padEnd(22)} ${String(a.p50).padStart(10)} ${String(b.p50).padStart(10)} ${diff(a.p50, b.p50, 0).padStart(8)}`);
  console.log(`  ${"p90 wins".padEnd(22)} ${String(a.p90).padStart(10)} ${String(b.p90).padStart(10)} ${diff(a.p90, b.p90, 0).padStart(8)}`);
  console.log(`  ${"p99 wins".padEnd(22)} ${String(a.p99).padStart(10)} ${String(b.p99).padStart(10)} ${diff(a.p99, b.p99, 0).padStart(8)}`);
  console.log(`  ${"Best observed".padEnd(22)} ${String(a.best).padStart(10)} ${String(b.best).padStart(10)} ${diff(a.best, b.best, 0).padStart(8)}`);
  console.log(`  ${"≥162 (162-0)".padEnd(22)} ${`${a.perfect}`.padStart(10)} ${`${b.perfect}`.padStart(10)}`);
  console.log(`  ${"≥116 wins".padEnd(22)} ${`${(a.hist116/N*100).toFixed(1)}%`.padStart(10)} ${`${(b.hist116/N*100).toFixed(1)}%`.padStart(10)}`);
  console.log(`  ${"≥90 wins".padEnd(22)} ${`${(a.hist90/N*100).toFixed(1)}%`.padStart(10)} ${`${(b.hist90/N*100).toFixed(1)}%`.padStart(10)}`);
}

const rndA = stats(runs["3SP+3RP:random"]);
const rndB = stats(runs["5SP+1RP:random"]);
const grdA = stats(runs["3SP+3RP:greedy"]);
const grdB = stats(runs["5SP+1RP:greedy"]);

row("Random strategy (pick any eligible player)", rndA, rndB);
row("Greedy strategy (always pick highest WAR)", grdA, grdB);

// 3. Win distribution comparison (greedy, most interesting)
console.log("\n  ── Win distribution — Greedy (buckets of 10)");
console.log(`  ${"Wins".padEnd(10)} ${"3SP+3RP".padStart(8)} ${"5SP+1RP".padStart(8)}`);
const allWins = [...grdA.wins, ...grdB.wins];
const minBucket = Math.floor(Math.min(...allWins) / 10) * 10;
const maxBucket = Math.floor(Math.max(...allWins) / 10) * 10;
for (let b = minBucket; b <= maxBucket; b += 10) {
  const cntA = grdA.wins.filter((w) => w >= b && w < b + 10).length;
  const cntB = grdB.wins.filter((w) => w >= b && w < b + 10).length;
  const pA = (cntA / N * 100).toFixed(1);
  const pB = (cntB / N * 100).toFixed(1);
  console.log(`  ${`${b}-${b+9}`.padEnd(10)} ${`${pA}%`.padStart(8)} ${`${pB}%`.padStart(8)}`);
}

console.log(`\n${"═".repeat(70)}\n`);
