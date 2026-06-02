"use client";

import { Player } from "@/lib/types";
import { formatAvg } from "@/lib/gameLogic";

interface Props {
  player: Player;
  mode: "classic" | "hoopiq";
  onSelect: (player: Player) => void;
  disabled?: boolean;
}

export default function PlayerCard({ player, mode, onSelect, disabled }: Props) {
  const isHitter = !!player.hitterStats;
  const showStats = mode === "classic";

  return (
    <button
      onClick={() => onSelect(player)}
      disabled={disabled}
      className="group relative w-full text-left bg-gray-800 hover:bg-gray-700 border-2 border-gray-600 hover:border-yellow-400 rounded-xl p-4 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {/* Position badge */}
      <span className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded bg-gray-700 text-gray-300">
        {player.position}
      </span>

      {/* Name + team/decade */}
      <div className="pr-10">
        <div className="font-bold text-white text-base leading-tight">{player.name}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {player.team} · {player.decade}
        </div>
      </div>

      {/* Stats */}
      {showStats && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          {isHitter && player.hitterStats ? (
            <div className="grid grid-cols-5 gap-1 text-center">
              <StatCell label="AVG" value={formatAvg(player.hitterStats.avg)} />
              <StatCell label="OBP" value={formatAvg(player.hitterStats.obp)} />
              <StatCell label="SLG" value={formatAvg(player.hitterStats.slg)} />
              <StatCell label="PA" value={player.hitterStats.pa.toString()} />
              <StatCell label="dWAR" value={player.hitterStats.dWAR.toFixed(1)} />
            </div>
          ) : player.pitcherStats ? (
            <div className="grid grid-cols-5 gap-1 text-center">
              <StatCell label="ERA" value={player.pitcherStats.era.toFixed(2)} />
              <StatCell label="WHIP" value={player.pitcherStats.whip.toFixed(2)} />
              <StatCell label="IP" value={player.pitcherStats.ip.toString()} />
              <StatCell label="K" value={player.pitcherStats.k.toString()} />
              <StatCell label="SV" value={player.pitcherStats.saves.toString()} />
            </div>
          ) : null}
        </div>
      )}

      {!showStats && (
        <div className="mt-3 pt-3 border-t border-gray-700 text-center text-xs text-gray-500 italic">
          Stats hidden — trust your baseball IQ
        </div>
      )}

      {/* Hover select indicator */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 border-2 border-yellow-400 pointer-events-none transition-opacity" />
    </button>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-gray-500 uppercase">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
