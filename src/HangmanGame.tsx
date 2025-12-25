import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { todayISO, applyResultToStats, loadStats, saveStats } from "./lib/storage";
import { msUntilNextLocalMidnight, formatCountdown } from "./lib/time";
import { loadHangmanPuzzles } from "./lib/hangmanPuzzles";
import type { HangmanPuzzle, HangmanState } from "./lib/hangman";
import { MAX_LIVES, mask, nextState, norm, solutionLetters } from "./lib/hangman";
import { loadHangmanState, saveHangmanState } from "./lib/storage";

function HangmanFigure({ wrong }: { wrong: number }) {
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
      <line x1="20" y1="140" x2="120" y2="140" className="hangmanStroke" />
      <line x1="40" y1="140" x2="40" y2="20" className="hangmanStroke" />
      <line x1="40" y1="20" x2="90" y2="20" className="hangmanStroke" />
      <line x1="90" y1="20" x2="90" y2="35" className="hangmanStroke" />

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
  ["A", "Á", "B", "D", "Ð", "E", "F",],
  ["G", "H", "I", "Í", "J", "K", "L",],
  ["M", "N", "O", "Ó", "P", "R", "S",],
  ["T", "U", "Ú", "V", "Y", "Ý", "Æ", "Ø"],
];

function initialState(): HangmanState {
  return { guesses: [], wrong: 0, status: "playing" };
}

function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addLocalDays(iso: string, deltaDays: number) {
  const base = new Date(iso + "T00:00:00");
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + deltaDays);
  return localISO(d);
}

function daysBetweenLocal(aISO: string, bISO: string) {
  const a = new Date(aISO + "T00:00:00");
  const b = new Date(bISO + "T00:00:00");
  const aa = startOfLocalDay(a).getTime();
  const bb = startOfLocalDay(b).getTime();
  return Math.floor((aa - bb) / (1000 * 60 * 60 * 24));
}

export default function HangmanGame() {
  const [puzzles, setPuzzles] = useState<HangmanPuzzle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [todayIso, setTodayIso] = useState(() => todayISO());
  const [stats, setStats] = useState(() => loadStats());
  const [countdown, setCountdown] = useState(() => formatCountdown(msUntilNextLocalMidnight()));
  const [copied, setCopied] = useState(false);

  const [showHelp, setShowHelp] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const START_DATE_ISO = "2025-12-23";
  const [dayOffset, setDayOffset] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(formatCountdown(msUntilNextLocalMidnight()));

      const nowIso = todayISO();
      setTodayIso((prev) => {
        if (prev !== nowIso) {
          setDayOffset(0);
          setCopied(false);
          setShowResult(false);
          return nowIso;
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    loadHangmanPuzzles()
      .then(setPuzzles)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const selectedDateISO = useMemo(() => addLocalDays(todayIso, dayOffset), [todayIso, dayOffset]);

  const picked = useMemo(() => {
    if (!puzzles) return null;

    const dayIndex = daysBetweenLocal(selectedDateISO, START_DATE_ISO);
    if (dayIndex < 0) return null;

    const idx = ((dayIndex % puzzles.length) + puzzles.length) % puzzles.length;
    return { dayIndex, puzzle: puzzles[idx] };
  }, [puzzles, selectedDateISO, START_DATE_ISO]);

  const dayKey = useMemo(() => {
    if (!picked) return null;
    return `hang__${selectedDateISO}__${picked.dayIndex}__${picked.puzzle.id}`;
  }, [picked, selectedDateISO]);

  const [state, setState] = useState<HangmanState>(() => initialState());

  useEffect(() => {
    if (!dayKey) return;

    const existing = loadHangmanState(dayKey) as HangmanState | null;
    const loaded = existing ?? initialState();
    setState(loaded);

    if (loaded.status === "won" || loaded.status === "lost") setShowResult(true);
    else setShowResult(false);

    setCopied(false);
  }, [dayKey]);

  const neededLetters = useMemo(() => {
    if (!picked) return new Set<string>();
    return solutionLetters(picked.puzzle.solution);
  }, [picked]);

  const guessesSet = useMemo(() => new Set(state.guesses), [state.guesses]);

  const masked = useMemo(() => {
    if (!picked) return "";
    return mask(picked.puzzle.solution, guessesSet);
  }, [picked, guessesSet]);

  const maxBack = useMemo(() => {
    const daysSinceStart = daysBetweenLocal(todayIso, START_DATE_ISO);
    return Math.max(0, daysSinceStart);
  }, [todayIso, START_DATE_ISO]);

  const canGoPrev = dayOffset > -maxBack;
  const canGoNext = dayOffset < 0;

  function commit(next: HangmanState) {
    if (!picked || !dayKey) return;

    const wasPlaying = state.status === "playing";
    const nowEnded = next.status === "won" || next.status === "lost";

    setState(next);
    saveHangmanState(dayKey, next);

    const isToday = selectedDateISO === todayIso;
    if (wasPlaying && nowEnded && isToday) {
      const result = { date: selectedDateISO, choiceIndex: -1, correct: next.status === "won" };
      const updated = applyResultToStats(stats, result);
      saveStats(updated);
      setStats(updated);
    }

    if (wasPlaying && nowEnded) setShowResult(true);
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

    const gameNumber = picked.dayIndex + 1;
    const title = `Orðafellan #${gameNumber}`;
    const icons = `${"❌".repeat(state.wrong)}${"✅".repeat(MAX_LIVES - state.wrong)}`;
    const streak = `Streak: ${stats.streak}`;
    const text = `${title}\n${icons}\n${streak}\nhttps://ordafellan.fo/`;

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

  function closeResult() {
    setShowResult(false);
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showHelp) closeHelp();
        if (showResult) closeResult();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showHelp, showResult]);

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
  const ended = state.status === "won" || state.status === "lost";

  return (
    <div className="page">
      <div className="app">
        <main className="card gameCard">
          <div className="gameTop">
            <div className="cardHeader">
              <div className="badge">Dagsins orðatak</div>
              <div className="timer">
                Nýtt spæl um <span className="mono">{countdown}</span>
              </div>
            </div>

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
          </div>

          <div className="gameKeyboard">
            <div className="keyboard" role="group" aria-label="On-screen keyboard">
              {KEYBOARD_ROWS.map((row, rIdx) => (
                <div
                  key={rIdx}
                  className="keyboardRow keyboardRowGrid"
                  style={{ ["--cols" as any]: row.length }}
                >
                  {row.map((L) => {
                    const used = guessesSet.has(norm(L));
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

            {ended && !showResult && (
              <div className="actions" style={{ marginTop: 10 }}>
                <button className="primaryBtn" onClick={() => setShowResult(true)}>
                  Vís úrslit
                </button>
              </div>
            )}
          </div>
        </main>

        <div className="footerBar" style={{ marginTop: 12 }}>
  {/* Row 1: Controls (centered) */}
  <div className="footerControls">
    <button className="iconBtn" onClick={() => setShowHelp(true)} aria-label="Hvussu spæli eg?">
      ?
    </button>

    <button
      className="iconBtn"
      onClick={() => setDayOffset((d) => Math.max(-maxBack, d - 1))}
      disabled={!canGoPrev}
      aria-label="Fyrra dag"
      title="Fyrra dag"
    >
      ←
    </button>

    <div className="pill">{selectedDateISO}</div>

    <button
      className="iconBtn"
      onClick={() => setDayOffset((d) => Math.min(0, d + 1))}
      disabled={!canGoNext}
      aria-label="Næsta dag"
      title="Næsta dag"
    >
      →
    </button>
  </div>

  {/* Row 2: Stats (centered) */}
  <div className="footerStats">{headerStats}</div>
  <div className="spacer" />
</div>
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

        {showResult && (
          <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="Úrslit" onMouseDown={closeResult}>
            <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <div className="modalTitle">{state.status === "won" ? "Sera flott! ✅" : "Betri eydnu næstu ferð ❌"}</div>
                <button className="iconBtn" onClick={closeResult} aria-label="Close">
                  ✕
                </button>
              </div>

              <div className="modalBody">
                <div className="hangmanRow">
                  <HangmanFigure wrong={state.wrong} />
                  <div className="hangmanMeta">
                    <div className="hangmanLabel">Mistøk</div>
                    <div className="hangmanValue">
                      {state.wrong} / {MAX_LIVES}
                    </div>
                    <div className="hangmanLabel">
                      {"❌".repeat(state.wrong)}
                      {"✅".repeat(MAX_LIVES - state.wrong)}
                    </div>
                  </div>
                </div>

                {state.status === "lost" && (
                  <div className="explain" style={{ marginTop: 10 }}>
                    Rætta orðatakið var: <strong>{picked.puzzle.solution}</strong>
                  </div>
                )}

                <div className="actions" style={{ marginTop: 12 }}>
                  <button onClick={share} className="primaryBtn">
                    Deil úrslit
                  </button>
                  {copied && <div className="copied">Úrslit viðheft!</div>}
                </div>

                <div className="privacyNote">Deilir bara úrslitið — ikki orðatakið.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
