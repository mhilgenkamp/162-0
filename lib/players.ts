import { Player } from "./types";
import playersJson from "./players.json";

export const ALL_PLAYERS: Player[] = playersJson as Player[];

// Derive TEAMS from the dataset so it always stays in sync
export const TEAMS: string[] = [...new Set(ALL_PLAYERS.map((p) => p.team))].sort();

export const DECADES = [
  "1920s", "1930s", "1940s", "1950s", "1960s",
  "1970s", "1980s", "1990s", "2000s", "2010s", "2020s",
] as const;
