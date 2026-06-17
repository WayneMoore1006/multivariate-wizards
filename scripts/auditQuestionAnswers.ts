// ============================================================================
// scripts/auditQuestionAnswers.ts   ·   npm run audit:questions
// Validates the bank's answer integrity and flags polluted acceptedAnswers.
//   - blankCount === answers.length === acceptedAnswers.length
//   - acceptedAnswers must not contain a *foreign* answer (known bad pairs)
//   - acceptedAnswers should not echo a keyword already shown in the stem
//   - reports HIGH-RISK (exit 1) vs LOW-RISK (informational)
// ============================================================================
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { normalizeAnswer } from "../shared/answerUtils";
import type { Question } from "../shared/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "..", "data", "questions.bilingual.json");

// stem fragment -> tokens that must NOT appear in that question's acceptedAnswers
const FORBIDDEN: { key: RegExp; bad: string[]; label: string }[] = [
  { key: /There are special MANOVA models, termed/i, bad: ["contrast"], label: "repeated measures ✗ contrast" },
  { key: /is a linear combination of the two or more independent variables to discriminate best/i, bad: ["potency index"], label: "discriminant variate ✗ potency index" },
  { key: /Objectives of MANOVA are to analyze a dependence relationship/i, bad: ["t test", "t-test", "anova"], label: "MANOVA objectives ✗ t-test/ANOVA" },
  { key: /The analysis sample is used to develop the discriminant function/i, bad: ["develop", "test", "estimate", "validate"], label: "holdout sample ✗ develop/test/estimate/validate" },
  { key: /for two-group situations and _+ for situations with three or more groups/i, bad: ["hotelling"], label: "MANOVA blank ✗ Hotelling's T2", onlyIfAnswer: /manova/i } as any,
  { key: /strength of the overall relationships between the linear composites/i, bad: ["box"], label: "canonical correlation ✗ Box's M" },
  { key: /summary measure of the ability of a set of independent variables to explain variation/i, bad: ["main effect"], label: "redundancy ✗ main effect" },
  { key: /these groups must be/i, bad: ["discriminant weight"], label: "mutually exclusive ✗ discriminant weight" },
  { key: /^Discriminant analysis is appropriate for research problems in which the dependent variable is categorical/i, bad: ["categorical", "nonmetric", "non-metric"], label: "regression ✗ categorical/nonmetric" },
  { key: /assumptions of multiple regression analysis to be examined are in four areas: linearity/i, bad: ["linearity"], label: "constant variance ✗ linearity" },
  { key: /Research problems appropriate for multiple regression are prediction and/i, bad: ["prediction"], label: "explanation ✗ prediction" },
];

function run() {
  const data: Question[] = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const high: string[] = [];
  const low: string[] = [];

  for (const q of data) {
    const stem = q.questionEn.replace(/\s+/g, " ").trim();
    const id = q.id || stem.slice(0, 40);

    // 1) shape consistency
    if (q.blankCount !== q.answers.length)
      high.push(`[shape] blankCount(${q.blankCount}) ≠ answers.length(${q.answers.length}) — «${stem.slice(0, 50)}»`);
    if (q.blankCount !== q.acceptedAnswers.length)
      high.push(`[shape] blankCount(${q.blankCount}) ≠ acceptedAnswers.length(${q.acceptedAnswers.length}) — «${stem.slice(0, 50)}»`);

    // 2) forbidden foreign answers
    const flatAccepted = q.acceptedAnswers.flat().map((a) => normalizeAnswer(a));
    for (const f of FORBIDDEN) {
      if (!f.key.test(stem)) continue;
      if ((f as any).onlyIfAnswer && !q.answers.some((a) => (f as any).onlyIfAnswer.test(a))) continue;
      for (const bad of f.bad) {
        const nb = normalizeAnswer(bad);
        if (flatAccepted.some((a) => a === nb || a.split(" ").includes(nb))) {
          high.push(`[foreign] ${f.label} — found "${bad}" in «${stem.slice(0, 45)}»`);
        }
      }
    }

    // 3) confirmatory single-blank must not have 3 groups
    if (/General approaches to variable selections include _+\s*,\s*sequential/i.test(stem) && q.acceptedAnswers.length > 1)
      high.push(`[shape] confirmatory single-blank has ${q.acceptedAnswers.length} groups — «${stem.slice(0, 45)}»`);

    // 4) (low-risk) accepted variant echoes a stem word
    for (let i = 0; i < q.acceptedAnswers.length; i++) {
      for (const v of q.acceptedAnswers[i]) {
        const nv = normalizeAnswer(v);
        if (nv && nv.length > 3 && normalizeAnswer(stem).split(" ").join(" ").includes(` ${nv} `)) {
          // only informational — proper nouns can legitimately repeat
          low.push(`[echo] "${v}" also in stem — «${stem.slice(0, 40)}»`);
        }
      }
    }

    // 5) empty zh / explanation
    if (!q.questionZh?.trim()) low.push(`[i18n] empty questionZh — ${id}`);
    if (!q.explanationZh?.trim()) low.push(`[i18n] empty explanationZh — ${id}`);
  }

  console.log(`\n===== audit:questions =====`);
  console.log(`questions: ${data.length}`);
  console.log(`HIGH-RISK issues: ${high.length}`);
  high.forEach((h) => console.log("  ✗ " + h));
  console.log(`LOW-RISK / informational: ${low.length}`);
  low.slice(0, 12).forEach((l) => console.log("  · " + l));
  if (low.length > 12) console.log(`  …and ${low.length - 12} more`);
  console.log(`===========================\n`);

  if (high.length > 0) { console.error("AUDIT FAILED: high-risk issues present."); process.exit(1); }
  console.log("AUDIT PASSED: no high-risk acceptedAnswers issues.");
}

run();
