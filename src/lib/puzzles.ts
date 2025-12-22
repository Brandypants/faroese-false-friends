import { daysSinceStart } from "./daily";

export type Puzzle = {
  id: string;
  word: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explain?: string;
};

export async function loadPuzzles(): Promise<Puzzle[]> {
  const res = await fetch("/data/puzzles.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load puzzles: ${res.status}`);
  const data = (await res.json()) as Puzzle[];
  validatePuzzles(data);
  return data;
}

export function pickTodayPuzzle(puzzles: Puzzle[], today = new Date()): { puzzle: Puzzle; dayIndex: number } {
  const dayIndex = daysSinceStart(today);
  const idx = ((dayIndex % puzzles.length) + puzzles.length) % puzzles.length;
  return { puzzle: puzzles[idx], dayIndex };
}

function validatePuzzles(puzzles: Puzzle[]) {
  if (!Array.isArray(puzzles) || puzzles.length === 0) throw new Error("puzzles.json is empty.");
  puzzles.forEach((p, i) => {
    if (!p.word || !p.prompt) throw new Error(`Puzzle ${i} missing word/prompt`);
    if (!Array.isArray(p.choices) || p.choices.length !== 4) throw new Error(`Puzzle ${i} must have 4 choices`);
    if (typeof p.answerIndex !== "number" || p.answerIndex < 0 || p.answerIndex > 3)
      throw new Error(`Puzzle ${i} answerIndex must be 0..3`);
  });
}
