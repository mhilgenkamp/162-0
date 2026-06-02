export type Decade =
  | "1920s"
  | "1930s"
  | "1940s"
  | "1950s"
  | "1960s"
  | "1970s"
  | "1980s"
  | "1990s"
  | "2000s"
  | "2010s"
  | "2020s";

export type Position = "C" | "1B" | "2B" | "3B" | "SS" | "LF" | "CF" | "RF" | "DH";
export type PitcherRole = "SP" | "RP";
export type SlotType = "hitter" | "pitcher";

export interface HitterStats {
  avg: number;
  obp: number;
  slg: number;
  pa: number;
  dWAR: number;
}

export interface PitcherStats {
  era: number;
  whip: number;
  ip: number;
  k: number;
  saves: number;
}

export interface Player {
  id: string;
  name: string;
  position: Position | PitcherRole;
  team: string;
  decade: Decade;
  war: number; // 3-year avg WAR — hidden from UI during selection
  hitterStats?: HitterStats;
  pitcherStats?: PitcherStats;
}

export interface RosterSlot {
  label: Position | PitcherRole;
  type: SlotType;
  player: Player | null;
}

export type GameMode = "classic" | "hoopiq";
export type GamePhase = "start" | "spinning" | "selecting" | "complete";

export interface SpinResult {
  team: string;
  decade: Decade;
}

export interface GameState {
  mode: GameMode;
  phase: GamePhase;
  roster: RosterSlot[];
  currentSlotIndex: number;
  spinResult: SpinResult | null;
  candidates: Player[];
  teamSkipsLeft: number;
  decadeSkipsLeft: number;
  projectedWins: number;
}
