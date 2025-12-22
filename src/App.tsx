import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { loadPuzzles, pickTodayPuzzle } from "./lib/puzzles";
import type { Puzzle } from "./lib/puzzles";
import {
  todayISO,
  applyResultToStats,
  loadStats,
  saveStats,
  loadDayResultV2,
  saveDayResultV2,
} from "./lib/storage";
import { msUntilNextLocalMidnight, formatCountdown } from "./lib/time";

type DayResult = { date: string; choiceIndex: number; correct: boolean };

export default function App() {
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dateISO = useMemo(() => todayISO(), []);
  const [stats, setStats] = useState(() => loadStats());
  const [countdown, setCountdown] = useState(() =>
    formatCountdown(msUntilNextLocalMidnight())
  );
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

    // Don't share the word or the chosen option; only the outcome.
    const title = `Orðafellan — ${dateISO}`;
    const outcome = dayResult.correct ? "✅" : "❌";
    const streak = `Streak: ${stats.streak}`;
    const next = `New in: ${countdown}`;

    const text = `${title}\n${outcome}\n${streak}\n${next}`;

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  if (error)
    return (
      <div className="page">
        <div className="app">
          <div className="card">
            <div className="resultTitle">Error</div>
            <div className="explain">{error}</div>
          </div>
        </div>
      </div>
    );

  if (!puzzles || !picked)
    return (
      <div className="page">
        <div className="app">
          <header className="topbar">
            <div className="brand">
            <div className="brandMark">
               <img className="brandLogo" src="/favi.png" alt="Orðafellan logo" />
             </div>
              <div>
                <div className="brandName">Orðafellan</div>
                <div className="brandTag">Eitt spæl um dagin</div>
              </div>
            </div>
            <div className="pill">{dateISO}</div>
          </header>

          <main className="card">
            <div className="loadingLine" />
            <div className="loadingLine short" />
            <div className="loadingChoices">
              <div className="loadingBtn" />
              <div className="loadingBtn" />
              <div className="loadingBtn" />
              <div className="loadingBtn" />
            </div>
          </main>

          <footer className="footer">New puzzle in: {countdown}</footer>
        </div>
      </div>
    );

  const { puzzle } = picked;

  const headerStats = `Played ${stats.played} · Wins ${stats.wins} · Streak ${stats.streak} · Best ${stats.maxStreak}`;

  return (
    <div className="page">
      <div className="app">
        <header className="topbar">
          <div className="brand">
          <div className="brandMark">
              <img className="brandLogo" src="/favicon.png" alt="Orðafellan logo" />
          </div>

            <div className="brandText">
              <div className="brandName">Orðafellan</div>
              <div className="brandTag">Eitt spæl um dagin</div>
            </div>
          </div>

          <div className="rightHeader">
            <div className="pill">{dateISO}</div>
            <div className="mini">{headerStats}</div>
          </div>
        </header>

        <main className="card">
          <div className="cardHeader">
            <div className="badge">Dagsins orð</div>
            <div className="timer">
              New puzzle in <span className="mono">{countdown}</span>
            </div>
          </div>

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
                <button
                  key={idx}
                  onClick={() => onChoose(idx)}
                  disabled={locked}
                  className={className}
                  aria-pressed={isChosen}
                >
                  {c}
                  {locked && isCorrect && <span className="choiceIcon">✓</span>}
                  {locked && isChosen && !isCorrect && (
                    <span className="choiceIcon">×</span>
                  )}
                </button>
              );
            })}
          </div>

          {dayResult && (
            <div className="result">
              <div className="resultTop">
                <div className="resultTitle">
                  {dayResult.correct ? "Rætt ✅" : "Ikki heilt ❌"}
                </div>

                <div className="resultPills">
                  <span className="smallPill">
                    {dayResult.correct ? "Win" : "Loss"}
                  </span>
                  <span className="smallPill">Streak {stats.streak}</span>
                </div>
              </div>

              {puzzle.explain && <div className="explain">{puzzle.explain}</div>}

              <div className="actions">
                <button onClick={share} className="primaryBtn">
                  Share result
                </button>
                {copied && <div className="copied">Copied!</div>}
              </div>

              <div className="privacyNote">
                Deilir bara um tú hevði rætt/ikki rætt — ikki orðið.
              </div>
            </div>
          )}
        </main>

        <footer className="footer">
          <div className="footerRow">
            <span className="mono">Orðafellan</span>
            <span className="dot">•</span>
            <span>One puzzle per day</span>
            <span className="dot">•</span>
            <span>Stats saved on this device</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
