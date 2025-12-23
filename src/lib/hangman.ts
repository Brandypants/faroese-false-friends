export type HangmanPuzzle = {
    id: string;
    solution: string; // Faroese saying/sentence
    hint?: string;
  };
  
  export type HangmanState = {
    guesses: string[]; // normalized lowercase letters guessed
    wrong: number;     // 0..6
    status: "playing" | "won" | "lost";
  };
  
  export const MAX_LIVES = 6;
  
  // Faroese letters + extra loanword letters
  const LETTER_RE = /^[a-záððíóúýæø]$/;
  
  // Normalize but keep Faroese diacritics distinct (o != ó)
  export function norm(ch: string): string {
    return ch.toLocaleLowerCase("fo-FO");
  }
  
  export function isGuessableLetter(chRaw: string): boolean {
    const ch = norm(chRaw);
    return LETTER_RE.test(ch);
  }
  
  // Collect the set of letters that must be guessed to win
  export function solutionLetters(solution: string): Set<string> {
    const s = new Set<string>();
    for (const raw of solution) {
      const ch = norm(raw);
      if (isGuessableLetter(ch)) s.add(ch);
    }
    return s;
  }
  
  // Mask only letters; keep spaces/punctuation as-is.
  export function mask(solution: string, guesses: Set<string>): string {
    let out = "";
    for (const raw of solution) {
      const ch = norm(raw);
      if (!isGuessableLetter(ch)) {
        out += raw; // space, comma, etc.
      } else {
        out += guesses.has(ch) ? raw : "•"; // "_" also works if you prefer
      }
    }
    return out;
  }
  
  export function nextState(puzzle: HangmanPuzzle, state: HangmanState, letterRaw: string): HangmanState {
    if (state.status !== "playing") return state;
  
    const letter = norm(letterRaw);
    if (!isGuessableLetter(letter)) return state;
  
    const guesses = new Set(state.guesses);
    if (guesses.has(letter)) return state;
  
    guesses.add(letter);
  
    const needed = solutionLetters(puzzle.solution);
    const wasCorrect = needed.has(letter);
    const wrong = state.wrong + (wasCorrect ? 0 : 1);
  
    const won = [...needed].every((l) => guesses.has(l));
    const lost = wrong >= MAX_LIVES;
  
    return {
      guesses: [...guesses],
      wrong,
      status: won ? "won" : lost ? "lost" : "playing",
    };
  }
  