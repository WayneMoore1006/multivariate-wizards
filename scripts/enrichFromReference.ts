// ============================================================================
// scripts/enrichFromReference.ts
// Fills questionZh / explanationZh / explanationEn from data/reference-gallery.json
// (the curated bilingual quiz bank). IMPORTANT: this NEVER edits acceptedAnswers —
// answer correctness is owned by the parser + answerCorrections.ts, so enrichment
// can never re-pollute answers. Anything unmatched gets a clean template fallback,
// so no question is ever left with empty Chinese / explanation.
// ============================================================================
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { Question } from "../shared/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REF_PATH = path.join(__dirname, "..", "data", "reference-gallery.json");

interface RefEntry {
  en: string; zh?: string; answerEN?: string; answerZH?: string;
  explainEN?: string; explainZH?: string; blanks?: string[][];
}

function loadRef(): RefEntry[] {
  try { return JSON.parse(fs.readFileSync(REF_PATH, "utf8")); } catch { return []; }
}

const norm = (s: string) => (s || "").toLowerCase()
  .replace(/[_\u2574\u2500\u2015\u23af]+/g, " ")
  .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function dice(a: string, b: string): number {
  a = norm(a); b = norm(b);
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bg = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const g = s.substr(i, 2); m.set(g, (m.get(g) ?? 0) + 1); } return m; };
  const x = bg(a), y = bg(b); let inter = 0;
  for (const [g, c] of x) if (y.has(g)) inter += Math.min(c, y.get(g)!);
  return (2 * inter) / ((a.length - 1) + (b.length - 1));
}

const CH_TOPIC: Record<string, string> = {
  Ch5: "多元迴歸 (Multiple Regression)", Ch6: "MANOVA 與實驗設計", Ch7: "判別分析 (Discriminant Analysis)",
  Ch8: "Logistic Regression", Ch9: "結構方程模式 (SEM)", Ch10: "驗證性因素分析 (CFA)", Ch11: "SEM", Ch12: "量表 (Scales)",
};
const tmplZh = (q: Question) =>
  `本題考的是 ${q.chapter}・${CH_TOPIC[q.chapter] || q.tags?.[0] || "多變量分析"} 的核心概念，正確答案為「${q.answers.join(" / ")}」。題幹描述的正是此概念的定義或判準，建議連同章節重點一起記憶。`;
const tmplEn = (q: Question) =>
  `This ${q.chapter} item tests a core concept of ${q.tags?.[0] || "multivariate analysis"}. The correct answer is "${q.answers.join(" / ")}". The stem paraphrases this term's definition — a frequently tested point.`;

export function enrichFromReference(questions: Question[]): { questions: Question[]; matched: number } {
  const REF = loadRef();
  let matched = 0;
  const out = questions.map((q) => {
    let best: RefEntry | null = null, score = 0;
    for (const r of REF) {
      const sim = dice(q.questionEn, r.en);
      const pa = norm(q.answers.join(" "));
      const ra = norm(`${r.answerEN ?? ""} ${(r.blanks ?? []).flat().join(" ")}`);
      const ansHit = !!pa && !!ra && (ra.includes(pa) || pa.includes(ra));
      const s = sim + (ansHit ? 0.25 : 0);
      if (s > score) { score = s; best = r; }
    }
    const good = best && score >= 0.62;
    if (good) matched++;
    const hasZh = q.questionZh && q.questionZh.trim() && !/填空題（共/.test(q.questionZh);
    return {
      ...q,
      questionZh: good && best!.zh ? best!.zh : (hasZh ? q.questionZh : tmplZh(q)),
      explanationZh: q.explanationZh?.trim() ? q.explanationZh : (good && best!.explainZH ? best!.explainZH : tmplZh(q)),
      explanationEn: q.explanationEn?.trim() ? q.explanationEn : (good && best!.explainEN ? best!.explainEN : tmplEn(q)),
    };
  });
  return { questions: out, matched };
}
