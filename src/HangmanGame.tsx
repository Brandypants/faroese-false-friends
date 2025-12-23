import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { applyResultToStats, loadStats, saveStats } from "./lib/storage";
import { msUntilNextLocalMidnight, formatCountdown } from "./lib/time";
import { loadHangmanPuzzles } from "./lib/hangmanPuzzles";
import type { HangmanPuzzle, HangmanState } from "./lib/hangman";
import { MAX_LIVES, mask, nextState, norm, solutionLetters } from "./lib/hangman";
import { loadHangmanState, saveHangmanState } from "./lib/storage";

function HangmanFigure({ wrong }: { wrong: number }) {
  // Clamp to 0..6
  const w = Math.max(0, Math.min(6, wrong));

  const showHead = w >= 1;
  const showBody = w >= 2;
  const showLeftArm = w >= 3;
  const showRightArm = w >= 4;
  const showLeftLeg = w >= 5;
  const showRightLeg = w >= 6;

  return (
    <svg
      viewBox="0 0 140 160"
      className="hangmanSvg"
      role="img"
      aria-label={`Hangman figure. Wrong guesses: ${w} of 6.`}
    >
      {/* Gallows */}
      <line x1="20" y1="140" x2="120" y2="140" className="hangmanStroke" />
      <line x1="40" y1="140" x2="40" y2="20" className="hangmanStroke" />
      <line x1="40" y1="20" x2="90" y2="20" className="hangmanStroke" />
      <line x1="90" y1="20" x2="90" y2="35" className="hangmanStroke" />

      {/* Person (progressively revealed) */}
      {showHead && <circle cx="90" cy="48" r="13" className="hangmanStroke" />}
      {showBody && <line x1="90" y1="61" x2="90" y2="98" className="hangmanStroke" />}
      {showLeftArm && <line x1="90" y1="72" x2="72" y2="88" className="hangmanStroke" />}
      {showRightArm && <line x1="90" y1="72" x2="108" y2="88" className="hangmanStroke" />}
      {showLeftLeg && <line x1="90" y1="98" x2="74" y2="122" className="hangmanStroke" />}
      {showRightLeg && <line x1="90" y1="98" x2="106" y2="122" className="hangmanStroke" />}
    </svg>
  );
}

const KEYBOARD_ROWS: string[][] = [
  ["A", "Á", "B", "C", "D", "Ð", "E", "F", "G", "H"],
  ["I", "Í", "J", "K", "L", "M", "N", "O", "Ó", "P"],
  ["Q", "R", "S", "T", "U", "Ú", "V", "W", "X", "Y", "Ý", "Z", "Æ", "Ø"],
];

function initialState(): HangmanState {
  return { guesses: [], wrong: 0, status: "playing" };
}

// Local YYYY-MM-DD (avoid UTC surprises)
function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Launch day: set this to "today" and keep it fixed.
// IMPORTANT: once you deploy, DO NOT change this date unless you want to reshuffle the schedule.
const START_DATE_ISO = localISO(new Date());

function daysBetweenLocal(a: Date, b: Date) {
  const aa = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.floor((aa - bb) / (1000 * 60 * 60 * 24));
}


export default function HangmanGame() {
  const [puzzles, setPuzzles] = useState<HangmanPuzzle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState(() => loadStats());
  const [countdown, setCountdown] = useState(() => formatCountdown(msUntilNextLocalMidnight()));
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // 0 = í dag, 1 = í gjár, ...
  const [dayOffset, setDayOffset] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(formatCountdown(msUntilNextLocalMidnight()));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    loadHangmanPuzzles()
      .then(setPuzzles)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Compute selected date and ISO
  const selectedDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - dayOffset);
    return d;
  }, [dayOffset]);

  const selectedDateISO = useMemo(() => localISO(selectedDate), [selectedDate]);

  // Limit browsing so it doesn't scroll forever: one full cycle of your puzzles
  const maxOffset = 0;

  useEffect(() => {
    if (dayOffset > maxOffset) setDayOffset(maxOffset);
  }, [dayOffset, maxOffset]);

  // Pick puzzle deterministically based on "today index - offset"
  const picked = useMemo(() => {
    if (!puzzles) return null;
  
    const start = new Date(START_DATE_ISO + "T00:00:00");
    const today = new Date();
    const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
    // dayIndex: 0 today, 1 tomorrow, etc.
    const dayIndex = daysBetweenLocal(todayLocal, start);
  
    // Use dayIndex directly (0..puzzles.length-1). After that, wrap.
    const idx = ((dayIndex % puzzles.length) + puzzles.length) % puzzles.length;
  
    return { dayIndex, puzzle: puzzles[idx] };
  }, [puzzles]);
  

  // Key per selected day so archive doesn't reuse today's state
  const dayKey = useMemo(() => {
    if (!picked) return null;
    return `hang__${selectedDateISO}__${picked.dayIndex}__${picked.puzzle.id}`;
  }, [picked, selectedDateISO]);

  const [state, setState] = useState<HangmanState>(() => initialState());

  useEffect(() => {
    if (!dayKey) return;
    const existing = loadHangmanState(dayKey) as HangmanState | null;
    setState(existing ?? initialState());
  }, [dayKey]);

  // keyboard coloring needs the set of letters in the solution
  const neededLetters = useMemo(() => {
    if (!picked) return new Set<string>();
    return solutionLetters(picked.puzzle.solution);
  }, [picked]);

  const guessesSet = useMemo(() => new Set(state.guesses), [state.guesses]);

  const masked = useMemo(() => {
    if (!picked) return "";
    return mask(picked.puzzle.solution, guessesSet);
  }, [picked, guessesSet]);

  function commit(next: HangmanState) {
    if (!picked || !dayKey) return;

    const wasPlaying = state.status === "playing";
    const nowEnded = next.status === "won" || next.status === "lost";

    setState(next);
    saveHangmanState(dayKey, next);

    // Update stats only once when the puzzle ends
    if (wasPlaying && nowEnded) {
      const isToday = dayOffset === 0;

      if (isToday) {
        // Normal stats + streak for today
        const result = {
          date: selectedDateISO,
          choiceIndex: -1,
          correct: next.status === "won",
        };
        const updated = applyResultToStats(stats, result);
        saveStats(updated);
        setStats(updated);
      } else {
        // Rule 1: archive play affects played/wins only, not streak/maxStreak
        const updated = {
          ...stats,
          played: (stats.played ?? 0) + 1,
          wins: (stats.wins ?? 0) + (next.status === "won" ? 1 : 0),
          streak: stats.streak ?? 0,
          maxStreak: stats.maxStreak ?? 0,
        };
        saveStats(updated);
        setStats(updated);
      }
    }
  }

  function onGuess(letter: string) {
    if (!picked) return;
    if (state.status !== "playing") return;
    const next = nextState(picked.puzzle, state, letter);
    commit(next);
  }

  function keyClass(letter: string) {
    const l = norm(letter);
    const used = guessesSet.has(l);
    if (!used) return "key key-unused";
    return neededLetters.has(l) ? "key key-correct" : "key key-wrong";
  }

  function share() {
    if (!picked) return;
    if (state.status === "playing") return;

    const title = `Hangman (Orðafellan) — ${selectedDateISO}`;
    const correctIcons = "✅".repeat(MAX_LIVES - state.wrong);
    const wrongIcons = "❌".repeat(state.wrong);
    const icons = `${wrongIcons}${correctIcons}`;
    const streak = `Streak: ${stats.streak}`;
    const next = `Nýggj gáta um: ${countdown} tímar`;

    // Privacy-friendly: does NOT include the saying
    // NOTE: update this URL to your real domain once it’s live.
    const text = `${title}\n${icons}\n${streak}\n${next}\nhttps://www.ordafellan.fo/`;

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  function closeHelp() {
    setShowHelp(false);
  }

  // close modal on Escape
  useEffect(() => {
    if (!showHelp) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHelp();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showHelp]);

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
          <div className="card">
            <div className="resultTitle">Loading…</div>
            <div className="explain">Heintar dagsins orðatak.</div>
          </div>
        </div>
      </div>
    );

  const headerStats = `Spælt ${stats.played} · Vunnið ${stats.wins} · Streak ${stats.streak} · Best ${stats.maxStreak}`;
  const hint = picked.puzzle.hint;
  const isToday = dayOffset === 0;

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
              <div className="brandTag">Hangman · eitt spæl um dagin</div>
            </div>
          </div>

          <div className="rightHeader">
            <div className="headerActions">
              <button className="iconBtn" onClick={() => setShowHelp(true)} aria-label="Hvussu spæli eg?">
                ?
              </button>

              <button
                className="iconBtn"
                onClick={() => setDayOffset((x) => Math.min(maxOffset, x + 1))}
                disabled={dayOffset >= maxOffset}
                aria-label="Fyri dag"
                title="Fyri dag"
              >
                ←
              </button>

              <div className="pill" title={isToday ? "Í dag" : "Fyri dag"}>
                {selectedDateISO}
                {isToday ? " · Í dag" : ""}
              </div>

              <button
                className="iconBtn"
                onClick={() => setDayOffset((x) => Math.max(0, x - 1))}
                disabled={dayOffset <= 0}
                aria-label="Næsti dagur"
                title="Næsti dagur"
              >
                →
              </button>
            </div>

            <div className="mini">{headerStats}</div>
          </div>
        </header>

        <main className="card">
          <div className="cardHeader">
            <div className="badge">{isToday ? "Dagsins orðatak" : "Frá arkivinum"}</div>
            <div className="timer">
              Nýtt spæl um <span className="mono">{countdown}</span>
            </div>
          </div>

          {/* Hangman drawing */}
          <div className="hangmanRow">
            <HangmanFigure wrong={state.wrong} />
            <div className="hangmanMeta">
              <div className="hangmanLabel">Mistøk</div>
              <div className="hangmanValue">
                {state.wrong} / {MAX_LIVES}
              </div>
            </div>
          </div>

          {hint && <div className="hint">Hint: {hint}</div>}

          <div className="masked" aria-label="Puzzle">
            {masked}
          </div>

          {/* Keyboard */}
          <div className="keyboard" role="group" aria-label="On-screen keyboard">
            {KEYBOARD_ROWS.map((row, rIdx) => (
              <div key={rIdx} className="keyboardRow">
                {row.map((L) => {
                  const l = norm(L);
                  const used = guessesSet.has(l);
                  const disabled = used || state.status !== "playing";

                  return (
                    <button
                      key={L}
                      className={keyClass(L)}
                      disabled={disabled}
                      onClick={() => onGuess(L)}
                      aria-pressed={used}
                    >
                      {L}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {(state.status === "won" || state.status === "lost") && (
            <div className="result">
              <div className="resultTitle">{state.status === "won" ? "Rætt! ✅" : "Betri eydnu næstu ferð ❌"}</div>

              {state.status === "lost" && (
                <div className="explain" style={{ marginTop: 8 }}>
                  Rætta orðatakið var: <strong>{picked.puzzle.solution}</strong>
                </div>
              )}

              <div className="actions" style={{ marginTop: 12 }}>
                <button onClick={share} className="primaryBtn">
                  Share result
                </button>
                {copied && <div className="copied">Copied!</div>}
              </div>

              <div className="privacyNote">Deilir bara úrslitið — ikki orðatakið.</div>
              {!isToday && <div className="privacyNote">Arkiv-spøl telja ikki við í streak.</div>}
            </div>
          )}
        </main>

        <footer className="footer">
          <div className="footerRow">
            <span className="mono">Orðafellan</span>
            <span className="dot">•</span>
            <span>Hangman</span>
            <span className="dot">•</span>
            <span>Stats saved on this device</span>
          </div>
        </footer>

        {/* How to play modal */}
        {showHelp && (
          <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="How to play" onMouseDown={closeHelp}>
            <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <div className="modalTitle">Soleiðis spælir tú</div>
                <button className="iconBtn" onClick={closeHelp} aria-label="Close">
                  ✕
                </button>
              </div>

              <div className="modalBody">
                <p>
                  Gita dagsins orðatak við at trýsta á bókstavir. Tú hevur <strong>6 lív</strong>.
                </p>

                <ul>
                  <li>Rættur bókstavur verður vístur í setninginum.</li>
                  <li>Rangur bókstavur kostar eitt lív.</li>
                  <li>Tá allir bókstavirnir eru funnir, vinnur tú.</li>
                </ul>

                <div className="legend">
                  <div className="legendItem">
                    <span className="legendSwatch key-correct" /> Rætt git
                  </div>
                  <div className="legendItem">
                    <span className="legendSwatch key-wrong" /> Rangt git
                  </div>
                  <div className="legendItem">
                    <span className="legendSwatch key-unused" /> Ikki brúktur
                  </div>
                </div>

                <div className="modalFooterNote">Tip: Millumrúm og tekin eru longu sjónlig.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
