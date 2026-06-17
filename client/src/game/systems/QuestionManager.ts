// client/src/game/systems/QuestionManager.ts
import type { Question, Difficulty } from "@shared/types";

const API = (import.meta as any).env?.VITE_SERVER_URL || "http://localhost:3001";

let cache: Question[] | null = null;

/** Load from static /questions.json first (offline bot/stats), then server API. */
export async function loadQuestions(): Promise<Question[]> {
  if (cache) return cache;
  // 1) static file published by importQuestions
  try {
    const r = await fetch("/questions.json", { cache: "no-store" });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data) && data.length) { cache = data; return cache; }
    }
  } catch { /* fall through */ }
  // 2) server API
  try {
    const r = await fetch(`${API}/api/questions`);
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data) && data.length) { cache = data; return cache; }
    }
  } catch { /* fall through */ }
  // 3) built-in stub so the game never hard-fails
  cache = STUB;
  return cache;
}

export function pick(all: Question[], count: number, difficulty?: Difficulty): Question[] {
  const pool = all.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const filtered = difficulty ? pool.filter((q) => q.difficulty === difficulty) : pool;
  const src = filtered.length >= count ? filtered : pool;
  return src.slice(0, Math.min(count, src.length));
}

const STUB: Question[] = [
  {
    id: "stub_1", chapter: "Ch7", years: ["2025"], sourceLabels: ["stub"],
    questionEn: "______ is calculated as the number of objects in the diagonal of the classification matrix divided by the total number of objects.",
    questionZh: "【Classification】填空題（共 1 格）", answers: ["Hit ratio"],
    acceptedAnswers: [["Hit ratio", "hit ratio"]], blankCount: 1, difficulty: "easy",
    tags: ["Classification"], isMakeupExam: false, canonicalQuestion: "", duplicateGroupId: "d1",
  },
  {
    id: "stub_2", chapter: "Ch7", years: ["2024"], sourceLabels: ["stub"],
    questionEn: "Discriminant analysis is appropriate when the dependent variable is ______ and the independent variables are metric.",
    questionZh: "【Discriminant Analysis】填空題（共 1 格）", answers: ["nonmetric"],
    acceptedAnswers: [["nonmetric", "non-metric", "categorical"]], blankCount: 1, difficulty: "easy",
    tags: ["Discriminant Analysis"], isMakeupExam: false, canonicalQuestion: "", duplicateGroupId: "d2",
  },
];
