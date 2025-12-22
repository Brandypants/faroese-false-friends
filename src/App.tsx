import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { loadPuzzles, pickTodayPuzzle } from "./lib/puzzles";
import type { Puzzle } from "./lib/puzzles";
import { todayISO, applyResultToStats, loadStats, saveStats, loadDayResultV2, saveDayResultV2 } from "./lib/storage";
import { msUntilNextLocalMidnight, formatCountdown } from "./lib/time";

type DayResult = { date: string; choiceIndex: number; correct: boolean };

export default function App() {
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dateISO = useMemo(() => todayISO(), []);
  const [stats, setStats] = useState(() => loadStats());
  const [countdown, setCountdown] = useState(() => formatCountdown(msUntilNextLocalMidnight()));
  const [copied, setCopied] = useState(false);

  const [dayResult, setDayResult] = useState<DayResult | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(formatCountdown(msUntilNextLocalMidnight()));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    loadPuzzles()
      .then(setPuzzles)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const picked = useMemo(() => {
    if (!puzzles) return null;
    return pickTodayPuzzle(puzzles, new Date());
  }, [puzzles]);

  // Key result by (date + dayIndex + puzzleId) so changing START_DATE doesn't reuse today's saved answer.
  const dayKey = useMemo(() => {
    if (!picked) return null;
    return `${dateISO}__${picked.dayIndex}__${picked.puzzle.id}`;
  }, [picked, dateISO]);

  useEffect(() => {
    if (!dayKey) return;
    const existing = loadDayResultV2(dayKey) as DayResult | null;
    setDayResult(existing);
  }, [dayKey]);

  function onChoose(choiceIndex: number) {
    if (!picked || !dayKey) return;
    if (dayResult) return;

    const correct = choiceIndex === picked.puzzle.answerIndex;
    const result: DayResult = { date: dateISO, choiceIndex, correct };

    saveDayResultV2(dayKey, result);
    setDayResult(result);

    const updated = applyResultToStats(stats, result);
    saveStats(updated);
    setStats(updated);
  }

  function share() {
    if (!picked || !dayResult) return;
    const title = `Faroese False Friends — ${dateISO}`;
    const line = `${picked.puzzle.word} ${dayResult.correct ? "✅" : "❌"}`;
    const streak = `Streak: ${stats.streak}`;
    const text = `${title}\n${line}\n${streak}`;

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  if (error) return <div className="app">Error: {error}</div>;
  if (!puzzles || !picked) return <div className="app">Loading…</div>;

  const { puzzle } = picked;

  return (
    <div className="page">
    <div className="app">
      <header className="topbar">
        <div>
          <h1 className="title">Faroese False Friends</h1>
          <div className="stats">
            Played: {stats.played} · Wins: {stats.wins} · Streak: {stats.streak} · Best: {stats.maxStreak}
          </div>
        </div>
        <div className="pill">{dateISO}</div>
      </header>

      <main className="card">
        <div className="word">{puzzle.word}</div>
        <div className="prompt">{puzzle.prompt}</div>

        <div className="choices">
          {puzzle.choices.map((c, idx) => {
            const locked = !!dayResult;
            const isCorrect = idx === puzzle.answerIndex;
            const isChosen = dayResult?.choiceIndex === idx;

            const className =
              "choiceBtn " +
              (locked
                ? isCorrect
                  ? "choice-correct"
                  : isChosen
                  ? "choice-wrong"
                  : "choice-neutral"
                : "");

            return (
              <button key={idx} onClick={() => onChoose(idx)} disabled={locked} className={className}>
                {c}
              </button>
            );
          })}
        </div>

        {dayResult && (
          <div className="result">
            <div className="resultTitle">{dayResult.correct ? "Correct ✅" : "Not quite ❌"}</div>
            {puzzle.explain && <div className="explain">{puzzle.explain}</div>}

            <div className="actions">
              <button onClick={share} className="primaryBtn">
                Share
              </button>
              {copied && <div className="copied">Copied!</div>}
            </div>
          </div>
        )}
      </main>

      <footer className="footer">New puzzle in: {countdown}</footer>
    </div>
    </div>
  );
}
