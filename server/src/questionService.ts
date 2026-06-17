// ============================================================================
// server/src/questionService.ts
// Loads the question bank with graceful fallback:
//   questions.bilingual.json -> questions.deduped.json -> seedQuestions.json
// ============================================================================
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { Question, PublicQuestion, Difficulty } from "../../shared/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, "../../data");

const ORDER = ["questions.bilingual.json", "questions.deduped.json", "seedQuestions.json"];

let bank: Question[] = [];

export function loadBank(): Question[] {
  for (const f of ORDER) {
    const p = path.join(DATA, f);
    try {
      if (fs.existsSync(p)) {
        const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
        if (Array.isArray(parsed) && parsed.length) {
          bank = parsed;
          console.log(`[questions] loaded ${parsed.length} from ${f}`);
          return bank;
        }
      }
    } catch (e) {
      console.warn(`[questions] failed to read ${f}:`, (e as Error).message);
    }
  }
  console.warn("[questions] no bank found — using a tiny built-in stub.");
  bank = STUB;
  return bank;
}

export function getBank(): Question[] {
  if (!bank.length) loadBank();
  return bank;
}

export function toPublic(q: Question): PublicQuestion {
  return {
    id: q.id, chapter: q.chapter, years: q.years,
    questionEn: q.questionEn, questionZh: q.questionZh,
    blankCount: q.blankCount, difficulty: q.difficulty, tags: q.tags,
  };
}

export function pickQuestions(count: number, difficulty?: Difficulty): Question[] {
  const pool = getBank().slice();
  // shuffle
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
    tags: ["Classification"], isMakeupExam: false, canonicalQuestion: "", duplicateGroupId: "stub_d1",
  },
];
