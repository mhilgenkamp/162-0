"use client";

import { RosterSlot } from "@/lib/types";

interface Props {
  roster: RosterSlot[];
  activeSlots: Set<string>;
}

export default function RosterPanel({ roster, activeSlots }: Props) {
  const hitters = roster.slice(0, 9);
  const pitchers = roster.slice(9);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-2 px-1">Lineup</div>
        <div className="flex flex-col gap-1">
          {hitters.map((slot, i) => (
            <RosterRow key={`h-${i}`} slot={slot} isOpen={activeSlots.has(slot.label)} />
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-2 px-1">Pitching Staff</div>
        <div className="flex flex-col gap-1">
          {pitchers.map((slot, i) => (
            <RosterRow key={`p-${i}`} slot={slot} isOpen={activeSlots.has(slot.label)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RosterRow({ slot, isOpen }: { slot: RosterSlot; isOpen: boolean }) {
  const isEmpty = slot.player === null;
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
        slot.player
          ? "bg-gray-800 border border-gray-700"
          : isOpen
          ? "bg-gray-900 border border-gray-700 opacity-80"
          : "bg-gray-900 border border-gray-800 opacity-40"
      }`}
    >
      <span className="text-xs font-bold text-gray-400 w-7 shrink-0">{slot.label}</span>
      {slot.player ? (
        <>
          <span className="text-sm text-white truncate flex-1">{slot.player.name}</span>
          <span className="text-xs text-gray-500 shrink-0">{slot.player.decade}</span>
        </>
      ) : (
        <span className={`text-sm italic flex-1 ${isOpen ? "text-gray-500" : "text-gray-700"}`}>
          {isEmpty ? "—" : ""}
        </span>
      )}
    </div>
  );
}
