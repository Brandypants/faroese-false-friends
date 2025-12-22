import { toISODate } from "./daily";

type DayResult = {
  date: string;       // YYYY-MM-DD
  choiceIndex: number;
  correct: boolean;
};

type Stats = {
  played: number;
  wins: number;
  streak: number;
  maxStreak: number;
  lastPlayed?: string; // YYYY-MM-DD
};

const KEY_STATS = "ff_stats_v1";
const KEY_DAY_PREFIX = "ff_day_v2_"; // bump version so old bad keys are ignored

export function loadStats(): Stats {
  const raw = localStorage.getItem(KEY_STATS);
  if (!raw) return { played: 0, wins: 0, streak: 0, maxStreak: 0 };
  try { return JSON.parse(raw) as Stats; } catch { return { played: 0, wins: 0, streak: 0, maxStreak: 0 }; }
}

export function saveStats(s: Stats) {
  localStorage.setItem(KEY_STATS, JSON.stringify(s));
}

export function loadDayResult(dateISO: string): DayResult | null {
  const raw = localStorage.getItem(KEY_DAY_PREFIX + dateISO);
  if (!raw) return null;
  try { return JSON.parse(raw) as DayResult; } catch { return null; }
}

export function saveDayResult(dateISO: string, result: DayResult) {
  localStorage.setItem(KEY_DAY_PREFIX + dateISO, JSON.stringify(result));
}

export function loadDayResultV2(key: string) {
  const raw = localStorage.getItem(KEY_DAY_PREFIX + key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function saveDayResultV2(key: string, result: any) {
  localStorage.setItem(KEY_DAY_PREFIX + key, JSON.stringify(result));
}


export function applyResultToStats(stats: Stats, result: DayResult): Stats {
  // Only count once per date (caller should enforce this)
  const next: Stats = { ...stats };
  next.played += 1;
  if (result.correct) next.wins += 1;

  // streak logic: correct extends streak if yesterday was lastPlayed or lastPlayed undefined
  if (result.correct) {
    if (!next.lastPlayed) {
      next.streak = 1;
    } else {
      const last = new Date(next.lastPlayed);
      const today = new Date(result.date);
      const lastDate = new Date(last.getFullYear(), last.getMonth(), last.getDate());
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
      next.streak = diffDays === 1 ? next.streak + 1 : 1;
    }
    next.maxStreak = Math.max(next.maxStreak, next.streak);
  } else {
    // wrong answer breaks streak
    next.streak = 0;
  }

  next.lastPlayed = result.date;
  return next;
}

export function todayISO(): string {
  return toISODate(new Date());
}
