"use client";

import { useState, useCallback } from "react";
import { GameMode, GamePhase, RosterSlot, Player, SpinResult } from "@/lib/types";
import {
  ROSTER_TEMPLATE,
  calcProjectedWins,
  spin,
  getCandidates,
  placePlayer,
  formatWins,
  getWinColor,
} from "@/lib/gameLogic";
// calcProjectedWins used only on complete screen
import PlayerList from "@/components/PlayerList";
import RosterPanel from "@/components/RosterPanel";

const freshRoster = (): RosterSlot[] => ROSTER_TEMPLATE.map((t) => ({ ...t, player: null }));

export default function Home() {
  const [mode, setMode] = useState<GameMode>("classic");
  const [phase, setPhase] = useState<GamePhase>("start");
  const [roster, setRoster] = useState<RosterSlot[]>(freshRoster());
  const [spinResult, setSpinResult] = useState<SpinResult>(spin());
  const [candidates, setCandidates] = useState<Player[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [teamSkipsLeft, setTeamSkipsLeft] = useState(1);
  const [decadeSkipsLeft, setDecadeSkipsLeft] = useState(1);
  const [showRoster, setShowRoster] = useState(false);

  const pickNumber = roster.filter((s) => s.player !== null).length + 1;
  const draftedCount = roster.filter((s) => s.player !== null).length;

  const getDraftedIds = (r: RosterSlot[]) =>
    new Set(r.filter((s) => s.player).map((s) => s.player!.id));

  const runSpin = useCallback(
    (currentRoster: RosterSlot[], overrides?: Partial<SpinResult>) => {
      const base = spin();
      const result: SpinResult = {
        team: overrides?.team ?? base.team,
        decade: overrides?.decade ?? base.decade,
      };
      setSpinResult(result);
      setSpinning(true);
      setPhase("spinning");

      // After the animation, find a combo with eligible players.
      // If the spun combo is empty, silently re-spin (no animation) until we hit one.
      setTimeout(() => {
        const draftedIds = getDraftedIds(currentRoster);

        let finalResult = result;
        let pool = getCandidates(finalResult, currentRoster, draftedIds);

        // Keep re-rolling until we get at least one eligible player (cap at 50 tries)
        let attempts = 0;
        while (pool.length === 0 && attempts < 50) {
          finalResult = spin();
          pool = getCandidates(finalResult, currentRoster, draftedIds);
          attempts++;
        }

        setSpinResult(finalResult);
        setCandidates(pool);
        setSpinning(false);
        setPhase("selecting");
      }, 1400);
    },
    []
  );

  const startGame = useCallback(() => {
    const r = freshRoster();
    setRoster(r);
    setTeamSkipsLeft(1);
    setDecadeSkipsLeft(1);
    runSpin(r);
  }, [runSpin]);

  const handleSkipTeam = () => {
    if (teamSkipsLeft === 0) return;
    setTeamSkipsLeft((n) => n - 1);
    runSpin(roster, { decade: spinResult.decade });
  };

  const handleSkipDecade = () => {
    if (decadeSkipsLeft === 0) return;
    setDecadeSkipsLeft((n) => n - 1);
    runSpin(roster, { team: spinResult.team });
  };

  const handleSelectPlayer = (player: Player) => {
    const newRoster = placePlayer(roster, player);
    setRoster(newRoster);

    if (newRoster.every((s) => s.player !== null)) {
      setPhase("complete");
      return;
    }

    runSpin(newRoster);
  };

  // ── Start screen ─────────────────────────────────────────────────────────
  if (phase === "start") {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <h1 className="text-7xl font-black tracking-tighter text-white mb-2">162-0</h1>
          <p className="text-gray-400 text-lg mb-8">
            Build the greatest baseball roster ever assembled. Can you go undefeated?
          </p>

          <div className="bg-gray-800 rounded-2xl p-6 mb-6 text-left space-y-3 text-sm text-gray-300">
            <p>
              • Each round a <strong className="text-white">team + decade</strong> is spun —
              pick any player from that pool
            </p>
            <p>
              • Fill <strong className="text-white">9 position slots</strong> and{" "}
              <strong className="text-white">6 pitcher slots</strong> across 15 picks
            </p>
            <p>
              • You get <strong className="text-white">1 team skip</strong> and{" "}
              <strong className="text-white">1 decade skip</strong>
            </p>
            <p>
              • Win projection uses <strong className="text-white">WAR</strong> — 114 total WAR
              gets you to 162-0
            </p>
          </div>

          <div className="flex bg-gray-800 rounded-xl p-1 mb-6">
            <button
              onClick={() => setMode("classic")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === "classic" ? "bg-yellow-500 text-gray-900" : "text-gray-400"
              }`}
            >
              Classic
            </button>
            <button
              onClick={() => setMode("hoopiq")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === "hoopiq" ? "bg-yellow-500 text-gray-900" : "text-gray-400"
              }`}
            >
              Baseball IQ
            </button>
          </div>

          <button
            onClick={startGame}
            className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-black text-xl rounded-xl transition-all active:scale-95"
          >
            Play Ball
          </button>
        </div>
      </main>
    );
  }

  // ── Complete screen ───────────────────────────────────────────────────────
  if (phase === "complete") {
    const wins = calcProjectedWins(roster);
    return (
      <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center p-6 pt-10">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-black tracking-tighter mb-2">162-0</h1>
            {wins >= 150 && (
              <div className="text-yellow-400 text-2xl font-black">PERFECT SEASON!</div>
            )}
            <div className={`text-6xl font-black mt-4 ${getWinColor(wins)}`}>
              {formatWins(wins)}
            </div>
            <div className="text-gray-400 mt-1">
              {wins >= 150
                ? "162-0 — the impossible achieved"
                : wins >= 116
                ? "All-time historic season"
                : wins >= 100
                ? "Division champion territory"
                : wins >= 90
                ? "Playoff contender"
                : "Rebuild time"}
            </div>
          </div>

          <RosterPanel roster={roster} activeSlots={new Set()} />

          <button
            onClick={() => {
              setRoster(freshRoster());
              setPhase("start");
            }}
            className="mt-6 w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-black text-xl rounded-xl transition-all active:scale-95"
          >
            Play Again
          </button>
        </div>
      </main>
    );
  }

  // ── Game screen ───────────────────────────────────────────────────────────
  const openSlots = new Set(roster.filter((s) => !s.player).map((s) => s.label));

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-800">
        <h1 className="text-xl font-black tracking-tight shrink-0">162-0</h1>

        {/* Spin result badges — hidden on mobile (shown in player list header) */}
        {spinning ? (
          <div className="hidden sm:flex gap-2 ml-1">
            <div className="h-7 w-36 bg-gray-800 rounded-full animate-pulse" />
            <div className="h-7 w-16 bg-gray-800 rounded-full animate-pulse" />
          </div>
        ) : (
          <div className="hidden sm:flex gap-2 items-center ml-1">
            <span className="bg-gray-700 text-white text-sm font-bold px-4 py-1 rounded-full">
              {spinResult.team}
            </span>
            <span className="bg-yellow-500 text-gray-900 text-sm font-bold px-4 py-1 rounded-full">
              {spinResult.decade}
            </span>
          </div>
        )}

        {/* Skips */}
        {!spinning && (
          <div className="flex gap-1.5 sm:gap-2 sm:ml-2">
            <button
              onClick={handleSkipTeam}
              disabled={teamSkipsLeft === 0}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 transition-colors border border-gray-700"
            >
              <span className="text-yellow-400">↻</span>
              <span className="hidden sm:inline">Team </span>({teamSkipsLeft})
            </button>
            <button
              onClick={handleSkipDecade}
              disabled={decadeSkipsLeft === 0}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 transition-colors border border-gray-700"
            >
              <span className="text-yellow-400">↻</span>
              <span className="hidden sm:inline">Decade </span>({decadeSkipsLeft})
            </button>
          </div>
        )}

        <div className="ml-auto text-sm text-gray-500 shrink-0">
          <span className="text-white font-bold">{pickNumber}</span>/15
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Player list — full width on mobile, flex-1 on desktop */}
        <div className={`flex-col p-3 overflow-hidden flex-1 ${showRoster ? "hidden md:flex" : "flex"}`}>
          {spinning ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-500 animate-pulse text-sm">Spinning...</div>
            </div>
          ) : (
            <PlayerList
              players={candidates}
              roster={roster}
              mode={mode}
              onSelect={handleSelectPlayer}
              teamLabel={spinResult.team}
              decadeLabel={spinResult.decade}
            />
          )}
        </div>

        {/* Roster panel — always visible on desktop, toggled on mobile */}
        <div className={`border-l border-gray-800 p-3 overflow-y-auto md:w-72 md:shrink-0 ${showRoster ? "flex flex-col w-full" : "hidden md:block"}`}>
          <RosterPanel roster={roster} activeSlots={openSlots} />
        </div>
      </div>

      {/* Mobile roster toggle */}
      <div className="md:hidden border-t border-gray-800 p-2">
        <button
          onClick={() => setShowRoster((v) => !v)}
          className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
            showRoster
              ? "bg-yellow-500 text-gray-900"
              : "bg-gray-800 text-white border border-gray-700"
          }`}
        >
          {showRoster ? "← Back to Players" : `Roster (${draftedCount} / 15)`}
        </button>
      </div>
    </main>
  );
}
