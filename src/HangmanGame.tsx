import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { todayISO, applyResultToStats, loadStats, saveStats } from "./lib/storage";
import { msUntilNextLocalMidnight, formatCountdown } from "./lib/time";
import { loadHangmanPuzzles, pickTodayHangman } from "./lib/hangmanPuzzles";
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

function livesArray(wrong: number) {
  // 6 lives total -> show 6 dots, filled for remaining, empty for used
  const used = Math.min(Math.max(wrong, 0), MAX_LIVES);
  const remaining = MAX_LIVES - used;
  return [
    ...Array.from({ length: remaining }, () => "full" as const),
    ...Array.from({ length: used }, () => "empty" as const),
  ];
}

export default function HangmanGame() {
  const [puzzles, setPuzzles] = useState<HangmanPuzzle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dateISO = useMemo(() => todayISO(), []);
  const [stats, setStats] = useState(() => loadStats());
  const [countdown, setCountdown] = useState(() => formatCountdown(msUntilNextLocalMidnight()));
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

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

  const picked = useMemo(() => {
    if (!puzzles) return null;
    return pickTodayHangman(puzzles, new Date());
  }, [puzzles]);

  const dayKey = useMemo(() => {
    if (!picked) return null;
    return `hang__${dateISO}__${picked.dayIndex}__${picked.puzzle.id}`;
  }, [picked, dateISO]);

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

  const lives = useMemo(() => livesArray(state.wrong), [state.wrong]);

  function commit(next: HangmanState) {
    if (!picked || !dayKey) return;

    const wasPlaying = state.status === "playing";
    const nowEnded = next.status === "won" || next.status === "lost";

    setState(next);
    saveHangmanState(dayKey, next);

    // Update streak/stats only once when the day finishes
    if (wasPlaying && nowEnded) {
      const result = { date: dateISO, choiceIndex: -1, correct: next.status === "won" };
      const updated = applyResultToStats(stats, result);
      saveStats(updated);
      setStats(updated);
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

    const title = `Orðafellan Hangman — ${dateISO}`;
    const outcome = state.status === "won" ? "✅" : "❌";
    const score = `${MAX_LIVES - state.wrong}/${MAX_LIVES}`;
    const streak = `Streak: ${stats.streak}`;
    const next = `New in: ${countdown}`;

    // Privacy-friendly: does NOT include the saying
    const text = `${title}\n${outcome} ${score}\n${streak}\n${next}`;

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
              <div className="pill">{dateISO}</div>
            </div>
            <div className="mini">{headerStats}</div>
          </div>
        </header>

        <main className="card">
          <div className="cardHeader">
            <div className="badge">Dagsins orðatak</div>
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
