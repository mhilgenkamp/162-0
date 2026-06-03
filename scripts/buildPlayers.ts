/**
 * buildPlayers.ts
 * Generates lib/players.json from Lahman SQLite + Baseball Reference WAR files.
 *
 * Data files required in scripts/data/:
 *   lahman.sqlite       — https://github.com/jknecht/baseball-archive-sqlite/releases
 *   war_daily_bat.txt   — https://www.baseball-reference.com/data/war_daily_bat.txt
 *   war_daily_pitch.txt — https://www.baseball-reference.com/data/war_daily_pitch.txt
 *
 * Run: npx tsx scripts/buildPlayers.ts
 */

import Database from "better-sqlite3";
import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";

const DATA_DIR  = path.join(__dirname, "data");
const OUT_FILE  = path.join(__dirname, "..", "lib", "players.json");

// Minimum 3-year avg WAR to include a player-franchise-decade record
const MIN_WAR_3YR   = 1.5;
const MIN_PA_SEASON = 100;   // hitter plate appearances
const MIN_IP_SEASON = 15;    // pitcher innings pitched

// ── Franchise ID → modern display name ───────────────────────────────────────
// Covers all MLB franchises active in 1920s–2020s.
// Lahman's franchID groups relocated teams under their current identity.
const FRANCHISE_NAMES: Record<string, string> = {
  ANA: "Los Angeles Angels",      // California/Anaheim/LA Angels
  ARI: "Arizona Diamondbacks",
  ATL: "Atlanta Braves",          // includes Boston & Milwaukee Braves
  BAL: "Baltimore Orioles",       // includes St. Louis Browns
  BOS: "Boston Red Sox",
  CHC: "Chicago Cubs",
  CHW: "Chicago White Sox",
  CIN: "Cincinnati Reds",
  CLE: "Cleveland Guardians",
  COL: "Colorado Rockies",
  DET: "Detroit Tigers",
  FLA: "Miami Marlins",           // Florida → Miami Marlins
  HOU: "Houston Astros",
  KCR: "Kansas City Royals",
  LAD: "Los Angeles Dodgers",     // includes Brooklyn Dodgers
  MIL: "Milwaukee Brewers",       // includes Seattle Pilots
  MIN: "Minnesota Twins",         // includes Washington Senators (AL original)
  NYM: "New York Mets",
  NYY: "New York Yankees",
  OAK: "Oakland Athletics",       // includes Philadelphia & Kansas City A's
  PHI: "Philadelphia Phillies",
  PIT: "Pittsburgh Pirates",
  SDP: "San Diego Padres",
  SEA: "Seattle Mariners",
  SFG: "San Francisco Giants",    // includes New York Giants
  STL: "St. Louis Cardinals",
  TBD: "Tampa Bay Rays",
  TEX: "Texas Rangers",           // includes Washington Senators (1961 expansion)
  TOR: "Toronto Blue Jays",
  WSN: "Washington Nationals",    // includes Montreal Expos
};

const VALID_DECADES = new Set([
  "1920s","1930s","1940s","1950s","1960s","1970s","1980s","1990s","2000s","2010s","2020s",
]);

function toDecade(year: number): string | null {
  const d = `${Math.floor(year / 10) * 10}s`;
  return VALID_DECADES.has(d) ? d : null;
}

// ── Load Lahman via SQLite ────────────────────────────────────────────────────
console.log("Opening Lahman SQLite...");
const db = new Database(path.join(DATA_DIR, "lahman.sqlite"), { readonly: true });

interface PersonRow  { playerID: string; nameFirst: string | null; nameLast: string | null; }
interface TeamRow    { teamID: string; yearID: number; franchID: string; }
interface FieldingRow     { playerID: string; yearID: number; POS: string; G: number; }
interface AppearancesRow  {
  playerID: string; yearID: number;
  G_dh: number; G_c: number; G_1b: number; G_2b: number; G_3b: number;
  G_ss: number; G_lf: number; G_cf: number; G_rf: number;
}
interface BattingRow  {
  playerID: string; yearID: number; teamID: string;
  AB: number; H: number; D: number; T: number; HR: number;
  BB: number; HBP: number; SF: number; SH: number;
}
interface PitchingRow {
  playerID: string; yearID: number; teamID: string;
  ERA: number | null; ER: number | null; IPouts: number;
  H: number; BB: number; SO: number; SV: number;
}
interface OutputRecord { position: string; decade: string; }

// playerID → full name
const nameMap = new Map<string, string>(
  (db.prepare("SELECT playerID, nameFirst, nameLast FROM People").all() as unknown as PersonRow[])
    .map((r) => [r.playerID, `${r.nameFirst ?? ""} ${r.nameLast ?? ""}`.trim()])
);

// (teamID, yearID) → franchID
const teamFranch = new Map<string, string>();
for (const r of db.prepare("SELECT teamID, yearID, franchID FROM Teams").all() as unknown as TeamRow[]) {
  teamFranch.set(`${r.teamID}-${r.yearID}`, r.franchID);
}

function franchID(teamID: string, year: number): string | null {
  return teamFranch.get(`${teamID}-${year}`) ?? null;
}

// (playerID, yearID) → primary game position
// Use FieldingOFsplit for outfielders (gives LF/CF/RF), Fielding for everyone else.
const posMap   = new Map<string, string>(); // "playerID-yearID" → position label
const posGames = new Map<string, number>(); // "playerID-yearID" → games at that position

const POS_REMAP: Record<string, string> = {
  C: "C", "1B": "1B", "2B": "2B", "3B": "3B", SS: "SS",
  LF: "LF", CF: "CF", RF: "RF", DH: "DH",
  OF: "LF", // fallback for generic OF (rare after using OFsplit)
  P: "P",   // resolved to SP/RP from pitching data
};

// Load FieldingOFsplit first (more specific for OF)
for (const r of db.prepare(
  "SELECT playerID, yearID, POS, G FROM FieldingOFsplit WHERE G > 0"
).all() as unknown as FieldingRow[]) {
  const key = `${r.playerID}-${r.yearID}`;
  const mapped = POS_REMAP[r.POS] ?? null;
  if (!mapped || !["LF", "CF", "RF"].includes(mapped)) continue;
  // Keep whichever position had most games (accumulate across stints)
  if (!posMap.has(key) || r.G > (posGames.get(key) ?? 0)) {
    posMap.set(key, mapped);
    posGames.set(key, r.G);
  }
}

// Fielding table for non-OF positions
for (const r of db.prepare(
  "SELECT playerID, yearID, POS, G FROM Fielding WHERE G > 0 AND POS != 'OF' AND POS != 'P'"
).all() as unknown as FieldingRow[]) {
  const key = `${r.playerID}-${r.yearID}`;
  const mapped = POS_REMAP[r.POS] ?? null;
  if (!mapped || mapped === "LF") continue; // skip OF fallback here
  if (!posMap.has(key) || r.G > (posGames.get(key) ?? 0)) {
    posMap.set(key, mapped);
    posGames.set(key, r.G);
  }
}

// DH detection via Appearances table (DH doesn't appear in Fielding at all)
// Override posMap if G_dh is the plurality position for that season
for (const r of db.prepare(
  "SELECT playerID, yearID, G_dh, G_c, G_1b, G_2b, G_3b, G_ss, G_lf, G_cf, G_rf FROM Appearances WHERE G_dh > 0"
).all() as unknown as AppearancesRow[]) {
  const key = `${r.playerID}-${r.yearID}`;
  const dhGames = r.G_dh ?? 0;
  // Max games at any fielding position this season
  const fieldMax = Math.max(r.G_c??0, r.G_1b??0, r.G_2b??0, r.G_3b??0, r.G_ss??0,
                            r.G_lf??0, r.G_cf??0, r.G_rf??0);
  if (dhGames > fieldMax) {
    posMap.set(key, "DH");
    posGames.set(key, dhGames);
  }
}

// (playerID, yearID, teamID) → batting display stats
type BatStats = { avg: number; obp: number; slg: number; pa: number };
const batStats = new Map<string, BatStats>();
for (const r of db.prepare(
  "SELECT playerID, yearID, teamID, AB, H, \"2B\" as D, \"3B\" as T, HR, BB, HBP, SF, SH FROM Batting"
).all() as unknown as BattingRow[]) {
  const ab = r.AB ?? 0, h = r.H ?? 0, d = r.D ?? 0, t = r.T ?? 0, hr = r.HR ?? 0;
  const bb = r.BB ?? 0, hbp = r.HBP ?? 0, sf = r.SF ?? 0, sh = r.SH ?? 0;
  const pa  = ab + bb + hbp + sf + sh;
  const avg = ab > 0 ? h / ab : 0;
  const obp = (ab + bb + hbp + sf) > 0 ? (h + bb + hbp) / (ab + bb + hbp + sf) : 0;
  const slg = ab > 0 ? (h + d + 2 * t + 3 * hr) / ab : 0;
  batStats.set(`${r.playerID}-${r.yearID}-${r.teamID}`, { avg, obp, slg, pa });
}

// (playerID, yearID, teamID) → pitching display stats
type PitchStats = { era: number; whip: number; ip: number; k: number; saves: number };
const pitchStats = new Map<string, PitchStats>();
for (const r of db.prepare(
  "SELECT playerID, yearID, teamID, ERA, IPouts, H, BB, SO, SV FROM Pitching"
).all() as unknown as PitchingRow[]) {
  const ip   = (r.IPouts ?? 0) / 3;
  const era  = r.ERA != null ? r.ERA : ip > 0 ? ((r.ER ?? 0) / ip) * 9 : 99;
  const whip = ip > 0 ? ((r.BB ?? 0) + (r.H ?? 0)) / ip : 99;
  pitchStats.set(`${r.playerID}-${r.yearID}-${r.teamID}`, {
    era:   Math.round(era * 100) / 100,
    whip:  Math.round(whip * 100) / 100,
    ip:    Math.round(ip),
    k:     r.SO ?? 0,
    saves: r.SV ?? 0,
  });
}

// ── Load bWAR files ───────────────────────────────────────────────────────────
console.log("Loading bWAR files...");

function loadCsv(file: string): Record<string, string>[] {
  return parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"), {
    columns: true, skip_empty_lines: true, trim: true,
  });
}

const warBatRows   = loadCsv("war_daily_bat.txt");
const warPitchRows = loadCsv("war_daily_pitch.txt");

// ── Aggregate bWAR batting: playerID → decade → franchName → seasons[] ───────
console.log("Building hitter WAR map...");

type BatSeason = { year: number; war: number; warDef: number; pa: number; teamID: string };

// Group by playerID → franchName → decade → seasons
const hitterPool = new Map<
  string, // playerID
  Map<string, Map<string, BatSeason[]>> // franchName → decade → seasons
>();

for (const r of warBatRows) {
  const pid  = r.player_ID;
  const year = parseInt(r.year_ID);
  const dec  = toDecade(year);
  if (!dec) continue;

  const war  = parseFloat(r.WAR) || 0;
  const pa   = parseInt(r.PA)   || 0;
  const warDef = parseFloat(r.WAR_def) || 0;
  if (pa < MIN_PA_SEASON) continue;

  // Resolve franchise via Lahman Teams using bWAR team_ID
  // bWAR team IDs mostly match Lahman (SFG vs SFN is a rare mismatch — handle via Teams lookup)
  let fid = franchID(r.team_ID, year);
  // Some bWAR team IDs differ from Lahman (e.g. "SFG" vs Lahman "SFN").
  // Try stripping/remapping common differences.
  if (!fid) {
    // bWAR uses 3-char codes; try appending/stripping trailing letter
    const alt = r.team_ID.length === 3 ? null : null;
    fid = alt ?? null;
  }
  if (!fid) continue;

  const modernTeam = FRANCHISE_NAMES[fid];
  if (!modernTeam) continue;

  if (!hitterPool.has(pid)) hitterPool.set(pid, new Map());
  const byFranch = hitterPool.get(pid)!;
  if (!byFranch.has(modernTeam)) byFranch.set(modernTeam, new Map());
  const byDec = byFranch.get(modernTeam)!;
  const arr = byDec.get(dec) ?? [];
  arr.push({ year, war, warDef, pa, teamID: r.team_ID });
  byDec.set(dec, arr);
}

// ── Aggregate bWAR pitching ───────────────────────────────────────────────────
console.log("Building pitcher WAR map...");

type PitchSeason = { year: number; war: number; ip: number; gs: number; g: number; teamID: string };

const pitcherPool = new Map<
  string,
  Map<string, Map<string, PitchSeason[]>>
>();

for (const r of warPitchRows) {
  const pid  = r.player_ID;
  const year = parseInt(r.year_ID);
  const dec  = toDecade(year);
  if (!dec) continue;

  const war = parseFloat(r.WAR) || 0;
  const ip  = (parseInt(r.IPouts) || 0) / 3;
  const gs  = parseInt(r.GS) || 0;
  const g   = parseInt(r.G)  || 0;
  if (ip < MIN_IP_SEASON) continue;

  const fid = franchID(r.team_ID, year);
  if (!fid) continue;

  const modernTeam = FRANCHISE_NAMES[fid];
  if (!modernTeam) continue;

  if (!pitcherPool.has(pid)) pitcherPool.set(pid, new Map());
  const byFranch = pitcherPool.get(pid)!;
  if (!byFranch.has(modernTeam)) byFranch.set(modernTeam, new Map());
  const byDec = byFranch.get(modernTeam)!;
  const arr = byDec.get(dec) ?? [];
  arr.push({ year, war, ip, gs, g, teamID: r.team_ID });
  byDec.set(dec, arr);
}

// ── Best 3-year consecutive window ───────────────────────────────────────────
function best3yr(seasons: { year: number; war: number }[]): { avgWar: number; midYear: number } {
  if (!seasons.length) return { avgWar: 0, midYear: 0 };
  const sorted = [...seasons].sort((a, b) => a.year - b.year);
  let best = { avgWar: -Infinity, midYear: sorted[0].year };
  for (let i = 0; i < sorted.length; i++) {
    const window: typeof sorted = [];
    for (let j = i; j < sorted.length && sorted[j].year - sorted[i].year <= 3; j++) {
      window.push(sorted[j]);
    }
    const window3 = window.slice(0, 3);
    const avg = window3.reduce((s, x) => s + x.war, 0) / window3.length;
    const mid = window3[Math.floor(window3.length / 2)].year;
    if (avg > best.avgWar) best = { avgWar: avg, midYear: mid };
  }
  return best;
}

function nearest<T extends { year: number }>(arr: T[], target: number): T {
  return arr.reduce((best, s) =>
    Math.abs(s.year - target) < Math.abs(best.year - target) ? s : best
  );
}

// ── Emit records ──────────────────────────────────────────────────────────────
console.log("Emitting player records...");
const output: object[] = [];

// Position players
for (const [pid, byFranch] of hitterPool) {
  const name = nameMap.get(pid);
  if (!name || name.trim() === "") continue;

  for (const [franchName, byDec] of byFranch) {
    for (const [dec, seasons] of byDec) {
      const { avgWar, midYear } = best3yr(seasons);
      if (avgWar < MIN_WAR_3YR) continue;

      const peak = nearest(seasons, midYear);

      // Get position — try peak year then nearby years
      let pos: string | null = null;
      for (let dy = 0; dy <= 2 && !pos; dy++) {
        pos = posMap.get(`${pid}-${peak.year + dy}`) ?? posMap.get(`${pid}-${peak.year - dy}`) ?? null;
      }
      if (!pos || pos === "P") continue; // pitchers handled separately
      const VALID_POS = new Set(["C","1B","2B","3B","SS","LF","CF","RF","DH"]);
      if (!VALID_POS.has(pos)) continue;

      // Get Lahman teamID for stats lookup: find season closest to peak in batStats
      // batStats key = playerID-yearID-teamID (Lahman teamID)
      // We stored teamID from bWAR as peak.teamID — try it directly, else search
      const statsKey = `${pid}-${peak.year}-${peak.teamID}`;
      const stats = batStats.get(statsKey) ??
        [...batStats.entries()]
          .filter(([k]) => k.startsWith(`${pid}-${peak.year}-`))
          .map(([, v]) => v)[0];

      output.push({
        id: `${pid}-${franchName.replace(/\s+/g, "")}-${dec}-bat`,
        name,
        position: pos,
        team: franchName,
        decade: dec,
        war: Math.round(avgWar * 10) / 10,
        hitterStats: stats ? {
          avg:  Math.round(stats.avg  * 1000) / 1000,
          obp:  Math.round(stats.obp  * 1000) / 1000,
          slg:  Math.round(stats.slg  * 1000) / 1000,
          pa:   Math.round(stats.pa),
          dWAR: Math.round(peak.warDef * 10) / 10,
        } : undefined,
      });
    }
  }
}

// Pitchers
for (const [pid, byFranch] of pitcherPool) {
  const name = nameMap.get(pid);
  if (!name || name.trim() === "") continue;

  for (const [franchName, byDec] of byFranch) {
    for (const [dec, seasons] of byDec) {
      const { avgWar, midYear } = best3yr(seasons);
      if (avgWar < MIN_WAR_3YR) continue;

      const peak = nearest(seasons, midYear);

      // SP vs RP: based on GS/G ratio across best window window
      const window3 = [...seasons]
        .sort((a, b) => a.year - b.year)
        .filter((s) => Math.abs(s.year - midYear) <= 2)
        .slice(0, 3);
      const totalGS = window3.reduce((s, x) => s + x.gs, 0);
      const totalG  = window3.reduce((s, x) => s + x.g,  0);
      const role = totalG > 0 && totalGS / totalG >= 0.4 ? "SP" : "RP";

      const statsKey = `${pid}-${peak.year}-${peak.teamID}`;
      const stats = pitchStats.get(statsKey) ??
        [...pitchStats.entries()]
          .filter(([k]) => k.startsWith(`${pid}-${peak.year}-`))
          .map(([, v]) => v)[0];

      output.push({
        id: `${pid}-${franchName.replace(/\s+/g, "")}-${dec}-pit`,
        name,
        position: role,
        team: franchName,
        decade: dec,
        war: Math.round(avgWar * 10) / 10,
        pitcherStats: stats ? {
          era:   stats.era,
          whip:  stats.whip,
          ip:    stats.ip,
          k:     stats.k,
          saves: stats.saves,
        } : undefined,
      });
    }
  }
}

// ── Write output ──────────────────────────────────────────────────────────────
fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
console.log(`\nDone — ${output.length} records → ${OUT_FILE}`);

const byPos: Record<string, number> = {};
const byDecade: Record<string, number> = {};
for (const p of output as unknown as OutputRecord[]) {
  byPos[p.position]  = (byPos[p.position]  ?? 0) + 1;
  byDecade[p.decade] = (byDecade[p.decade] ?? 0) + 1;
}
console.log("By position:", byPos);
console.log("By decade:",   byDecade);
