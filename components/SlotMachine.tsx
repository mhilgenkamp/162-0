"use client";

import { useEffect, useState } from "react";
import { SpinResult } from "@/lib/types";
import { TEAMS, DECADES } from "@/lib/players";

interface Props {
  result: SpinResult;
  spinning: boolean;
  onSkipTeam: () => void;
  onSkipDecade: () => void;
  teamSkipsLeft: number;
  decadeSkipsLeft: number;
}

export default function SlotMachine({
  result,
  spinning,
  onSkipTeam,
  onSkipDecade,
  teamSkipsLeft,
  decadeSkipsLeft,
}: Props) {
  // Animated values — only updated by the interval during a spin
  const [animatedTeam, setAnimatedTeam] = useState(result.team);
  const [animatedDecade, setAnimatedDecade] = useState(result.decade);

  // Derive what to show: use live prop when settled, animated value while spinning.
  // This avoids calling setState synchronously inside the effect body.
  const displayTeam = spinning ? animatedTeam : result.team;
  const displayDecade = spinning ? animatedDecade : result.decade;

  useEffect(() => {
    if (!spinning) return;
    let frame = 0;
    const interval = setInterval(() => {
      setAnimatedTeam(TEAMS[Math.floor(Math.random() * TEAMS.length)]);
      setAnimatedDecade(DECADES[Math.floor(Math.random() * DECADES.length)]);
      frame++;
      if (frame > 18) clearInterval(interval);
    }, 80);
    return () => clearInterval(interval);
  }, [spinning, result]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-4">
        {/* Team reel */}
        <div className="relative">
          <div
            className={`bg-gray-800 border-2 rounded-xl px-6 py-4 min-w-[220px] text-center transition-all duration-150 ${
              spinning
                ? "border-yellow-500 shadow-lg shadow-yellow-500/30"
                : "border-gray-600"
            }`}
          >
            <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Team</div>
            <div
              className={`text-lg font-bold leading-tight min-h-[52px] flex items-center justify-center transition-all ${
                spinning ? "text-yellow-400 blur-[1px]" : "text-white"
              }`}
            >
              {displayTeam}
            </div>
          </div>
          {!spinning && (
            <button
              onClick={onSkipTeam}
              disabled={teamSkipsLeft === 0}
              className="mt-2 w-full text-xs py-1 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 transition-colors"
            >
              Skip Team ({teamSkipsLeft} left)
            </button>
          )}
        </div>

        {/* Decade reel */}
        <div className="relative">
          <div
            className={`bg-gray-800 border-2 rounded-xl px-6 py-4 min-w-[120px] text-center transition-all duration-150 ${
              spinning
                ? "border-yellow-500 shadow-lg shadow-yellow-500/30"
                : "border-gray-600"
            }`}
          >
            <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Decade</div>
            <div
              className={`text-3xl font-black min-h-[52px] flex items-center justify-center transition-all ${
                spinning ? "text-yellow-400 blur-[1px]" : "text-white"
              }`}
            >
              {displayDecade}
            </div>
          </div>
          {!spinning && (
            <button
              onClick={onSkipDecade}
              disabled={decadeSkipsLeft === 0}
              className="mt-2 w-full text-xs py-1 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 transition-colors"
            >
              Skip Decade ({decadeSkipsLeft} left)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
