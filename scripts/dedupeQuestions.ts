// ============================================================================
// scripts/dedupeQuestions.ts
// Merge questions that test the SAME knowledge point across years. Fixed so that
// "same answer but different stem / different blank position" is NOT merged.
// ============================================================================
import { normalizeAnswer, similarity } from "../shared/answerUtils";
import type { Question } from "../shared/types";

export interface DuplicateGroup {
  duplicateGroupId: string;
  canonicalQuestion: string;
  members: { id: string; sourceLabels: string[]; questionEn: string }[];
  years: string[];
  answers: string[];
}

const QUESTION_SIM_THRESHOLD = 0.72;
const PROTECTED_SIM_THRESHOLD = 0.93; // protected stems must be ~identical to merge

// Stems routinely confused with longer/shorter siblings that share an answer.
// These may ONLY merge with a near-identical twin, never with a differently
// worded question that happens to share the same answer.
const PROTECTED_STANDALONE_PATTERNS: RegExp[] = [
  /The purpose of a .* design is to control for individual-level differences/i,
  /Approaches to assess the dependent variate in a MANOVA include Bonferroni inequality/i,
  /To further identify differences between individual groups in MANOVA, the researcher usually specifies the groups to be compared through a _+\.?\s*$/i,
  /The objective of the .* is to eliminate any effects/i,
  /In any univariate ANOVA design, metric independent variables, referred to as/i,
];

function isProtected(text: string): boolean {
  return PROTECTED_STANDALONE_PATTERNS.some((re) => re.test(text.trim()));
}

function answerKey(q: Question): string {
  return q.answers.map((a) => normalizeAnswer(a)).join("|");
}

function isDuplicate(rep: Question, q: Question): boolean {
  const qSim = similarity(rep.questionEn, q.questionEn);

  // Protected stems: require a near-identical twin to merge, regardless of answers.
  if (isProtected(rep.questionEn) || isProtected(q.questionEn)) {
    return qSim >= PROTECTED_SIM_THRESHOLD;
  }

  // Different blank structure => only merge when the stems are near-identical
  // (same question whose blanks were parsed differently across years).
  if (rep.blankCount !== q.blankCount) return qSim >= PROTECTED_SIM_THRESHOLD;

  const sameChapter = rep.chapter === q.chapter;
  const sameAnswers = answerKey(rep) === answerKey(q);
  const closeAnswers = sameAnswers || similarity(rep.answers.join(" "), q.answers.join(" ")) > 0.8;

  // Same answer alone is NOT enough — the stems must also be similar, otherwise
  // distinct questions that happen to share an answer (e.g. several "hit ratio"
  // definitions) would be wrongly collapsed.
  return qSim >= QUESTION_SIM_THRESHOLD && closeAnswers;
}

export function dedupeQuestions(questions: Question[]): {
  deduped: Question[];
  report: DuplicateGroup[];
} {
  const groups: Question[][] = [];

  for (const q of questions) {
    let placed = false;
    for (const g of groups) {
      if (g.some((m) => isDuplicate(m, q))) { g.push(q); placed = true; break; }
    }
    if (!placed) groups.push([q]);
  }

  const deduped: Question[] = [];
  const report: DuplicateGroup[] = [];
  let gid = 0;

  for (const g of groups) {
    gid++;
    const duplicateGroupId = `dup_${String(gid).padStart(3, "0")}`;
    const canonical = g.slice().sort((a, b) => b.questionEn.length - a.questionEn.length)[0];

    const years = Array.from(new Set(g.flatMap((q) => q.years))).sort();
    const sourceLabels = Array.from(new Set(g.flatMap((q) => q.sourceLabels)));
    const tags = Array.from(new Set(g.flatMap((q) => q.tags)));

    const blankCount = canonical.blankCount; // group members share blankCount now
    const accepted: string[][] = [];
    for (let i = 0; i < blankCount; i++) {
      const variants = new Set<string>();
      for (const q of g) {
        (q.acceptedAnswers[i] ?? []).forEach((v) => variants.add(v));
        if (q.answers[i]) variants.add(q.answers[i]);
      }
      accepted.push(Array.from(variants));
    }

    deduped.push({
      ...canonical,
      years, sourceLabels, tags,
      acceptedAnswers: accepted,
      blankCount,
      isMakeupExam: g.some((q) => q.isMakeupExam),
      duplicateGroupId,
      canonicalQuestion: canonical.questionEn,
    });

    if (g.length > 1) {
      report.push({
        duplicateGroupId,
        canonicalQuestion: canonical.questionEn,
        members: g.map((q) => ({ id: q.id, sourceLabels: q.sourceLabels, questionEn: q.questionEn })),
        years, answers: canonical.answers,
      });
    }
  }

  return { deduped, report };
}
