// ============================================================================
// shared/types.ts
// Shared data contracts used by the client, the server, and the import scripts.
// Keep this file dependency-free so every package can import it directly.
// ============================================================================

export type Difficulty = "easy" | "normal" | "hard";

/** A single parsed / deduped question from the docx bank. */
export interface Question {
  id: string;
  chapter: string;                 // e.g. "Ch7", "Ch6", "Canonical correlation"
  years: string[];                 // every year this question appeared in
  sourceLabels: string[];          // e.g. ["2025","2024","Exercise_Ch7"]
  questionEn: string;              // canonical English text (with blanks)
  questionZh: string;              // Chinese translation (may be placeholder)
  answers: string[];               // primary answer per blank
  acceptedAnswers: string[][];     // per-blank list of accepted variants
  blankCount: number;
  difficulty: Difficulty;
  tags: string[];
  isMakeupExam: boolean;
  canonicalQuestion: string;
  duplicateGroupId: string;
  explanationZh?: string;          // Chinese explanation (why this answer); may be a template fallback
  explanationEn?: string;          // English explanation
  rawAnswer?: string;              // original answer text incl. any "(課本p.488)" note (display/debug)
  answerNote?: string;             // extracted source/page/remark note — NEVER used for judging
}

/** Lightweight question shipped to the client (answers stripped for online play). */
export interface PublicQuestion {
  id: string;
  chapter: string;
  years: string[];
  questionEn: string;
  questionZh: string;
  blankCount: number;
  difficulty: Difficulty;
  tags: string[];
}

export type LanguageMode = "en" | "en_zh" | "zh";

export interface GameSettings {
  questionCount: number;           // 5 / 10 / 15 / 20 / custom
  timePerQuestion: number;         // seconds, default 30
  languageMode: LanguageMode;
  showChapterTag: boolean;
  showYearTag: boolean;
  botDifficulty?: Difficulty;      // only for 1v Bot
}

export const DEFAULT_SETTINGS: GameSettings = {
  questionCount: 10,
  timePerQuestion: 30,
  languageMode: "en_zh",
  showChapterTag: true,
  showYearTag: true,
  botDifficulty: "normal",
};

export type WizardKind = "fire" | "ice" | "thunder" | "dark";

export interface PlayerState {
  id: string;                      // socket id or "bot"
  nickname: string;
  wizard: WizardKind;
  hp: number;
  maxHp: number;
  ready: boolean;
  connected: boolean;
  combo: number;
  isBot?: boolean;
}

export type RoomPhase = "lobby" | "countdown" | "question" | "reveal" | "gameover";

export interface RoomState {
  code: string;
  phase: RoomPhase;
  settings: GameSettings;
  players: PlayerState[];
  questionIndex: number;
  totalQuestions: number;
}

/** Per-question runtime state on the server. */
export interface RoundState {
  index: number;
  question: PublicQuestion;
  startedAtMs: number;
  endsAtMs: number;
  roundId: string;          // unique per round — client uses it to drop stale timers
  roundTimeLimit: number;   // seconds for THIS round (depends on blankCount)
}

export interface SubmitAnswerPayload {
  roomCode: string;
  questionId: string;
  blanks: string[];
  answeredAtMs: number;            // client clock; server recomputes from its own timer
}

export interface AnswerCheck {
  isCorrect: boolean;
  correctBlanks: boolean[];
  submittedAnswers: string[];
  correctAnswers: string[];
  answeredAtMs: number;
}

export interface RoundResultPayload {
  index: number;
  correctAnswers: string[];
  acceptedAnswers: string[][];
  results: Record<string, AnswerCheck>;   // playerId -> check
  damageDealt: Record<string, number>;    // playerId -> damage they dealt
  hp: Record<string, number>;             // playerId -> hp after round
  combos: Record<string, number>;
  attackTypes?: Record<string, "normal" | "triple" | "grand">; // attacker -> visual attack type
  comboBroken?: Record<string, boolean>;  // playerId -> streak broken this round
  sourceYears: string[];
  questionEn: string;
  questionZh: string;
}

export interface GameOverPayload {
  winnerId: string | null;         // null = draw
  players: PlayerState[];
  perPlayerStats: Record<string, PlayerSummary>;
}

export interface PlayerSummary {
  correct: number;
  total: number;
  accuracy: number;
  avgAnswerMs: number;
  fastestMs: number | null;
  totalDamage: number;
  wrongQuestions: { questionEn: string; correctAnswers: string[]; your: string[] }[];
}

// --- Socket.IO event maps -------------------------------------------------

export interface ClientToServerEvents {
  createRoom: (p: { nickname: string; wizard: WizardKind; settings: GameSettings }, cb: (r: { code: string }) => void) => void;
  joinRoom: (p: { code: string; nickname: string; wizard: WizardKind }, cb: (r: { ok: boolean; error?: string; room?: RoomState }) => void) => void;
  playerReady: (p: { code: string; ready: boolean; wizard?: WizardKind }) => void;
  updateWizard: (p: { code: string; wizard: WizardKind }) => void;
  startGame: (p: { code: string }) => void;
  submitAnswer: (p: SubmitAnswerPayload) => void;
  leaveRoom: (p: { code: string }) => void;
}

export interface ServerToClientEvents {
  roomUpdate: (room: RoomState) => void;
  countdown: (p: { seconds: number }) => void;
  question: (p: { round: RoundState; room: RoomState }) => void;
  roundResult: (p: RoundResultPayload) => void;
  gameOver: (p: GameOverPayload) => void;
  opponentDisconnected: () => void;
  errorMsg: (p: { message: string }) => void;
}

export interface SocketEvents {
  client: ClientToServerEvents;
  server: ServerToClientEvents;
}
