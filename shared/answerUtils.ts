// ============================================================================
// shared/answerUtils.ts
// Text normalization + answer checking. Used by:
//   - scripts/importQuestions.ts  (parsing the docx)
//   - server/src/answerValidator.ts (authoritative checking)
//   - client AnswerValidator (instant feedback in 1vBot)
// ============================================================================

// Mathematical Bold letters/digits -> ASCII (the docx uses 𝐀𝐧𝐬𝐰𝐞𝐫 etc.)
function foldMathAlphanumerics(input: string): string {
  let out = "";
  for (const ch of input) {
    const cp = ch.codePointAt(0)!;
    // Mathematical Bold A-Z: U+1D400..U+1D419
    if (cp >= 0x1d400 && cp <= 0x1d419) out += String.fromCharCode(65 + (cp - 0x1d400));
    // Mathematical Bold a-z: U+1D41A..U+1D433
    else if (cp >= 0x1d41a && cp <= 0x1d433) out += String.fromCharCode(97 + (cp - 0x1d41a));
    // Mathematical Bold digits 0-9: U+1D7CE..U+1D7D7
    else if (cp >= 0x1d7ce && cp <= 0x1d7d7) out += String.fromCharCode(48 + (cp - 0x1d7ce));
    // Italic / bold-italic / sans variants fall back to plain forms
    else if (cp >= 0x1d434 && cp <= 0x1d44d) out += String.fromCharCode(65 + (cp - 0x1d434)); // italic A-Z
    else if (cp >= 0x1d44e && cp <= 0x1d467) out += String.fromCharCode(97 + (cp - 0x1d44e)); // italic a-z
    else out += ch;
  }
  return out;
}

/** Light fold used for DISPLAY text — keeps spaces & punctuation, fixes unicode. */
export function foldDisplay(text: string): string {
  return foldMathAlphanumerics(text)
    .normalize("NFKC")
    .replace(/\u2019|\u2018|\u02bc/g, "'") // curly apostrophes -> straight
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Aggressive normalization used for COMPARISON. */
/**
 * Separate an answer from a "note" annotation (textbook page / source / remark).
 * Notes must NOT affect answer judging. Meaningful parentheticals that are
 * synonyms / abbreviations (e.g. "(nominal or nonmetric)", "(AVE)", "(ANCOVA)")
 * are KEPT as part of the answer.
 *
 * Returns { clean, note } where `note` is the removed annotation text (or "").
 */
const NOTE_INNER =
  /(課本|textbook|參考課本|參考|補充|optional|note\s*[:：]|p\s*\.?\s*\d|pp\s*\.?\s*\d|page\s*\d)/i;

export function stripAnswerNote(text: string): { clean: string; note: string } {
  let s = (text || "").trim();
  const notes: string[] = [];

  // 1) parenthetical notes — only remove a (...) / （...） group whose inner text
  //    looks like a page/source/remark. Otherwise keep it (it's part of the answer).
  s = s.replace(/[（(]([^（）()]*)[）)]/g, (m, inner) => {
    if (NOTE_INNER.test(inner)) { notes.push(inner.trim()); return " "; }
    return m; // keep meaningful parens (synonym / abbreviation)
  });

  // 2) bare trailing/loose page or source refs not wrapped in parens
  //    e.g. "課本p.488", "textbook p.488", "p.488", "page 488", "pp.488-490"
  s = s.replace(/(?:參考)?課本\s*p+\.?\s*\d+(?:\s*[-–]\s*\d+)?/gi, (m) => { notes.push(m.trim()); return " "; });
  s = s.replace(/\btextbook\s*p+\.?\s*\d+(?:\s*[-–]\s*\d+)?/gi, (m) => { notes.push(m.trim()); return " "; });
  s = s.replace(/\bpp?\.?\s*\d+(?:\s*[-–]\s*\d+)?\b/gi, (m) => { notes.push(m.trim()); return " "; });
  s = s.replace(/\bpage\s*\d+\b/gi, (m) => { notes.push(m.trim()); return " "; });

  s = s.replace(/\s+/g, " ").trim();
  return { clean: s, note: notes.join("; ") };
}

export function normalizeAnswer(text: string): string {
  // strip textbook page / source / remark annotations before comparing
  let t = stripAnswerNote(text || "").clean;
  t = foldMathAlphanumerics(t);
  t = t.normalize("NFKC").toLowerCase();
  t = t.replace(/\u2019|\u2018|\u02bc/g, "'");
  t = t.replace(/'s\b/g, ""); // drop possessive ('s) e.g. Hotelling's -> Hotelling
  // T-squared variants -> "t2"
  t = t.replace(/t\s*\u00b2/g, "t2").replace(/t\s*square[d]?/g, "t2").replace(/t\^?2\b/g, "t2");
  t = t.replace(/[\u2010-\u2015]/g, "-"); // unicode dashes -> hyphen
  t = t.replace(/[.,;:!?'"`’“”()\[\]/\\\-]/g, " "); // drop punctuation
  t = t.replace(/\s+/g, " ").trim();
  // very light singular/plural smoothing on the final word
  t = t.replace(/(\w)s\b/g, "$1");
  return t;
}

/** Compare a single submitted blank against its list of accepted answers. */
export function blankMatches(submitted: string, accepted: string[]): boolean {
  const s = normalizeAnswer(submitted);
  if (!s) return false;
  return accepted.some((a) => {
    const n = normalizeAnswer(a);
    if (!n) return false;
    if (n === s) return true;
    // accept if one fully contains the other as a token sequence (e.g. "discriminant function" vs "function")
    return n.length > 3 && s.length > 3 && (n.includes(s) || s.includes(n));
  });
}

/**
 * Check a full multi-blank submission.
 * acceptedAnswers[i] = list of acceptable strings for blank i.
 */
export function checkAnswer(
  submitted: string[],
  acceptedAnswers: string[][],
  primaryAnswers: string[]
): { isCorrect: boolean; correctBlanks: boolean[] } {
  const n = acceptedAnswers.length || 1;
  const correctBlanks: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const accepted = acceptedAnswers[i] && acceptedAnswers[i].length ? acceptedAnswers[i] : [primaryAnswers[i] ?? ""];
    correctBlanks.push(blankMatches(submitted[i] ?? "", accepted));
  }
  return { isCorrect: correctBlanks.every(Boolean), correctBlanks };
}

/** Sørensen–Dice bigram similarity in [0,1] — used for dedupe. */
export function similarity(a: string, b: string): number {
  const x = normalizeAnswer(a);
  const y = normalizeAnswer(b);
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.substr(i, 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const ma = bigrams(x), mb = bigrams(y);
  let inter = 0;
  for (const [g, c] of ma) if (mb.has(g)) inter += Math.min(c, mb.get(g)!);
  const total = (x.length - 1) + (y.length - 1);
  return (2 * inter) / total;
}

// ---------------------------------------------------------------------------
// Explanation fallback — guarantees questionZh / explanationZh / explanationEn
// are never empty/undefined in the UI, even for un-enriched questions.
// ---------------------------------------------------------------------------
const CH_TOPIC_ZH: Record<string, string> = {
  Ch5: "多元迴歸 (Multiple Regression)",
  Ch6: "MANOVA 與實驗設計",
  Ch7: "判別分析 (Discriminant Analysis)",
  Ch8: "Logistic Regression",
  Ch9: "結構方程模式 (SEM)",
  Ch10: "驗證性因素分析 (CFA)",
  Ch11: "SEM 路徑分析",
  Ch12: "量表類型 (Scales)",
};

export function explanationZhFor(q: {
  chapter: string; answers: string[]; tags?: string[]; explanationZh?: string;
}): string {
  if (q.explanationZh && q.explanationZh.trim()) return q.explanationZh;
  const topic = CH_TOPIC_ZH[q.chapter] || q.tags?.[0] || "多變量分析";
  return `本題考的是 ${q.chapter}・${topic} 的核心概念，正確答案為「${q.answers.join(
    " / "
  )}」。題幹描述的正是此概念的定義或判準，屬於常見考點，建議連同章節重點一起記憶。`;
}

export function explanationEnFor(q: {
  chapter: string; answers: string[]; tags?: string[]; explanationEn?: string;
}): string {
  if (q.explanationEn && q.explanationEn.trim()) return q.explanationEn;
  const topic = q.tags?.[0] || "multivariate analysis";
  return `This ${q.chapter} item tests a core concept of ${topic}. The correct answer is "${q.answers.join(
    " / "
  )}". The stem paraphrases this term's definition — a frequently tested point.`;
}

export function questionZhFor(q: { questionZh?: string; questionEn: string }): string {
  if (q.questionZh && q.questionZh.trim() && !/填空題（共/.test(q.questionZh)) return q.questionZh;
  return q.questionEn; // safe fallback: show English so the panel never breaks
}
