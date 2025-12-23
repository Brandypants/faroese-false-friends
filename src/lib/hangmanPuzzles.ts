import type { HangmanPuzzle } from "./hangman";

// Keep this date stable once you launch
const START_DATE = new Date("2025-01-02T00:00:00");

// Same day index logic as your other game
export function dayIndexFor(date: Date): number {
  const ms = date.getTime() - START_DATE.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export async function loadHangmanPuzzles(): Promise<HangmanPuzzle[]> {
  const url = `${import.meta.env.BASE_URL}data/hangman.json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load hangman puzzles: ${res.status}`);
  const data = (await res.json()) as HangmanPuzzle[];
  if (!Array.isArray(data) || data.length === 0) throw new Error("Hangman puzzle list is empty.");
  return data;
}

export function pickTodayHangman(puzzles: HangmanPuzzle[], now = new Date()) {
  const dayIndex = dayIndexFor(now);
  const idx = ((dayIndex % puzzles.length) + puzzles.length) % puzzles.length;
  return { dayIndex, puzzle: puzzles[idx] };
}
