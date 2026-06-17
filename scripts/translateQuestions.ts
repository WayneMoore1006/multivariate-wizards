// ============================================================================
// scripts/translateQuestions.ts
// Fills questionZh. Translation is OPTIONAL: with no API key we generate a
// readable Chinese scaffold that keeps statistical terms in English, so the
// import never fails. Wire up a real translator later (see README).
// ============================================================================
import type { Question } from "../shared/types";

// Keep these domain terms in English in the Chinese view.
const KEEP_TERMS = [
  "MANOVA", "ANOVA", "ANCOVA", "Discriminant analysis", "Hit ratio", "Wilks' lambda",
  "Hotelling's T2", "Hotelling's T\u00b2", "Pillai's criterion", "Roy's gcr", "SEM",
  "CFA", "AVE", "VIF", "Bonferroni", "covariate", "holdout sample", "potency index",
  "Canonical correlation",
];

/** Heuristic placeholder Chinese: a short framing + the English stem preserved. */
function placeholderZh(q: Question): string {
  const focus = q.tags.filter((t) => t !== "General").join("、") || "多變量分析";
  return `【${focus}】填空題（共 ${q.blankCount} 格）：請依英文題目作答。`;
}

export function buildBilingual(questions: Question[]): Question[] {
  return questions.map((q) => ({
    ...q,
    questionZh: q.questionZh && q.questionZh.trim() ? q.questionZh : placeholderZh(q),
  }));
}

export { KEEP_TERMS };
