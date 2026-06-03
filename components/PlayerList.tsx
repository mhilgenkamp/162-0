"use client";

import { useState, useMemo } from "react";
import { Player, RosterSlot } from "@/lib/types";
import { formatAvg, resolveSlot } from "@/lib/gameLogic";

type PositionFilter = "All" | "Hitters" | "SP" | "RP";
type HitterSortKey = "ops" | "avg" | "pa" | "dWAR";
type PitcherSortKey = "era" | "whip" | "ip" | "k" | "saves";

interface Props {
  players: Player[];
  roster: RosterSlot[];
  mode: "classic" | "hoopiq";
  onSelect: (player: Player) => void;
  teamLabel: string;
  decadeLabel: string;
}

export default function PlayerList({
  players,
  roster,
  mode,
  onSelect,
  teamLabel,
  decadeLabel,
}: Props) {
  const [filter, setFilter] = useState<PositionFilter>("All");
  const [search, setSearch] = useState("");
  const [hitterSort, setHitterSort] = useState<HitterSortKey>("ops");
  const [pitcherSort, setPitcherSort] = useState<PitcherSortKey>("era");

  const hitters = players.filter((p) => !!p.hitterStats);
  const sps = players.filter((p) => p.position === "SP");
  const rps = players.filter((p) => p.position === "RP");

  const filtered = useMemo(() => {
    let pool =
      filter === "Hitters" ? hitters
      : filter === "SP"     ? sps
      : filter === "RP"     ? rps
      : players;

    if (search.trim()) {
      const q = search.toLowerCase();
      pool = pool.filter((p) => p.name.toLowerCase().includes(q));
    }

    return pool.sort((a, b) => {
      const aHitter = !!a.hitterStats;
      const bHitter = !!b.hitterStats;

      // Sort hitters among hitters, pitchers among pitchers
      if (aHitter && bHitter) {
        const av = a.hitterStats!;
        const bv = b.hitterStats!;
        if (hitterSort === "ops")  return (bv.obp + bv.slg) - (av.obp + av.slg);
        if (hitterSort === "avg")  return bv.avg - av.avg;
        if (hitterSort === "pa")   return bv.pa - av.pa;
        if (hitterSort === "dWAR") return bv.dWAR - av.dWAR;
      }
      if (!aHitter && !bHitter) {
        const ap = a.pitcherStats!;
        const bp = b.pitcherStats!;
        if (pitcherSort === "era")   return ap.era - bp.era;
        if (pitcherSort === "whip")  return ap.whip - bp.whip;
        if (pitcherSort === "ip")    return bp.ip - ap.ip;
        if (pitcherSort === "k")     return bp.k - ap.k;
        if (pitcherSort === "saves") return bp.saves - ap.saves;
      }
      // Hitters before pitchers in mixed view
      return aHitter ? -1 : 1;
    });
  }, [players, filter, search, hitterSort, pitcherSort, hitters, sps, rps]);

  const FILTERS: PositionFilter[] = ["All", "Hitters", "SP", "RP"];

  return (
    <div className="flex flex-col h-full">
      {/* Pool label */}
      <div className="flex items-center gap-2 mb-3">
        <span className="bg-gray-700 text-white text-sm font-bold px-3 py-1 rounded-full">
          {teamLabel}
        </span>
        <span className="bg-yellow-500 text-gray-900 text-sm font-bold px-3 py-1 rounded-full">
          {decadeLabel}
        </span>
        <span className="ml-auto text-xs text-gray-500">{filtered.length} available</span>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* Position filter tabs */}
        <div className="flex bg-gray-800 rounded-lg p-0.5 gap-0.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                filter === f
                  ? "bg-gray-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[120px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
        />

        {/* Sort — contextual to filter */}
        {(filter === "All" || filter === "Hitters") && (
          <select
            value={hitterSort}
            onChange={(e) => setHitterSort(e.target.value as HitterSortKey)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none"
          >
            <option value="ops">OPS</option>
            <option value="avg">AVG</option>
            <option value="pa">PA</option>
            <option value="dWAR">dWAR</option>
          </select>
        )}
        {(filter === "SP" || filter === "RP") && (
          <select
            value={pitcherSort}
            onChange={(e) => setPitcherSort(e.target.value as PitcherSortKey)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none"
          >
            <option value="era">ERA</option>
            <option value="whip">WHIP</option>
            <option value="ip">IP</option>
            <option value="k">K</option>
            <option value="saves">SV</option>
          </select>
        )}
      </div>

      {/* Player rows */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 py-8 text-sm">No players found.</div>
        )}
        {filtered.map((p) => (
          <PlayerRow key={`${p.id}-${p.position}`} player={p} roster={roster} mode={mode} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  roster,
  mode,
  onSelect,
}: {
  player: Player;
  roster: RosterSlot[];
  mode: "classic" | "hoopiq";
  onSelect: (p: Player) => void;
}) {
  const isHitter = !!player.hitterStats;
  const showStats = mode === "classic";
  const slot = resolveSlot(roster, player);
  const goesToDH = slot === "DH";

  return (
    <button
      onClick={() => onSelect(player)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-yellow-500/60 transition-all text-left group"
    >
      {/* Position badge */}
      <span className="shrink-0 flex items-center gap-1 text-xs font-bold py-0.5 rounded bg-gray-700 group-hover:bg-gray-600 text-gray-300 px-1.5">
        {player.position}
        {goesToDH && (
          <span className="text-yellow-400">→ DH</span>
        )}
      </span>

      {/* Name + team/decade */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white text-sm truncate">{player.name}</div>
        <div className="text-xs text-gray-500 truncate">
          {player.team} · {player.decade}
        </div>
      </div>

      {/* Stats */}
      {showStats && isHitter && player.hitterStats && (
        <>
          {/* Mobile: 2 key stats */}
          <div className="flex gap-3 shrink-0 text-right sm:hidden">
            <StatPair label="AVG" value={formatAvg(player.hitterStats.avg)} />
            <StatPair label="OPS" value={(player.hitterStats.obp + player.hitterStats.slg).toFixed(3)} />
          </div>
          {/* Desktop: full stats */}
          <div className="hidden sm:flex gap-4 shrink-0 text-right">
            <StatPair label="AVG" value={formatAvg(player.hitterStats.avg)} />
            <StatPair label="OBP" value={formatAvg(player.hitterStats.obp)} />
            <StatPair label="SLG" value={formatAvg(player.hitterStats.slg)} />
            <StatPair label="PA"  value={player.hitterStats.pa.toString()} />
            <StatPair label="dWAR" value={player.hitterStats.dWAR.toFixed(1)} />
          </div>
        </>
      )}
      {showStats && !isHitter && player.pitcherStats && (
        <>
          {/* Mobile: 2 key stats */}
          <div className="flex gap-3 shrink-0 text-right sm:hidden">
            <StatPair label="ERA"  value={player.pitcherStats.era.toFixed(2)} />
            <StatPair label="WHIP" value={player.pitcherStats.whip.toFixed(2)} />
          </div>
          {/* Desktop: full stats */}
          <div className="hidden sm:flex gap-4 shrink-0 text-right">
            <StatPair label="ERA"  value={player.pitcherStats.era.toFixed(2)} />
            <StatPair label="WHIP" value={player.pitcherStats.whip.toFixed(2)} />
            <StatPair label="IP"   value={player.pitcherStats.ip.toString()} />
            <StatPair label="K"    value={player.pitcherStats.k.toString()} />
            <StatPair label="SV"   value={player.pitcherStats.saves.toString()} />
          </div>
        </>
      )}
      {!showStats && (
        <span className="text-xs text-gray-600 italic shrink-0">Stats hidden</span>
      )}
    </button>
  );
}

function StatPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center min-w-[36px]">
      <div className="text-[10px] text-gray-500 uppercase leading-none">{label}</div>
      <div className="text-xs font-semibold text-white mt-0.5">{value}</div>
    </div>
  );
}
