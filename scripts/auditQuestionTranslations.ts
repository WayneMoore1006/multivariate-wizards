// ============================================================================
// scripts/auditQuestionTranslations.ts   ·   npm run audit:translations
// Validates zh translations + explanations for completeness and correctness.
// ============================================================================
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { Question } from "../shared/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "..", "data", "questions.bilingual.json");

// stem -> forbidden concepts in that question's zh/explanation
const CONCEPT_RULES: { key: RegExp; bad: RegExp[]; label: string }[] = [
  { key: /There are special MANOVA models, termed/i, bad: [/contrast/i, /planned comparison/i], label: "repeated-measures ✗ contrast" },
  { key: /groups to be compared through a/i, bad: [/repeated measures/i], label: "contrast ✗ repeated measures" },
  { key: /linear combination.*to discriminate best/i, bad: [/potency index/i], label: "disc-variate ✗ potency index" },
  { key: /strength of the overall relationships between the linear composites/i, bad: [/box.s m/i], label: "canonical ✗ Box's M" },
  { key: /summary measure of the ability.*explain variation/i, bad: [/main effect/i], label: "redundancy ✗ main effect" },
  { key: /analysis sample is used to develop/i, bad: [/develop.*答案|答案.*develop|validate.*答案|答案.*validate/i], label: "holdout ✗ develop/validate as answer" },
  { key: /Objectives of MANOVA are to analyze/i, bad: [/t-test|t 檢定/i, /\banova\b(?!.*manova)/i], label: "MANOVA-obj ✗ t-test/ANOVA" },
  // explanation question: the text correctly says "prediction is in the stem, answer is explanation"
  // — no concept confusion to detect here (acceptedAnswers already validated by audit:questions).
];

function countBlanks(text: string): number {
  const matches = text.match(/_{2,}|╴{2,}/g);
  return matches ? matches.length : 0;
}

function run() {
  const data: Question[] = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const high: string[] = [];
  const low: string[] = [];
  let emptyZh = 0, emptyExpZh = 0, emptyExpEn = 0, blankMismatch = 0;

  for (const q of data) {
    const stem = q.questionEn.replace(/\s+/g, " ").trim();
    const id = stem.slice(0, 45);

    // empty checks
    const isTemplateZh = !q.questionZh?.trim() || /填空題（共|本題考的是/.test(q.questionZh);
    const isTemplateExpZh = !q.explanationZh?.trim() || /本題考的是/.test(q.explanationZh);
    const isTemplateExpEn = !q.explanationEn?.trim() || /This .* item tests a core concept/.test(q.explanationEn);
    if (isTemplateZh) { emptyZh++; low.push(`[zh-template] ${id}`); }
    if (isTemplateExpZh) { emptyExpZh++; low.push(`[expZh-template] ${id}`); }
    if (isTemplateExpEn) { emptyExpEn++; low.push(`[expEn-template] ${id}`); }

    // blank count match: compare zh blanks against the authoritative blankCount
    const zhBlanks = q.questionZh ? countBlanks(q.questionZh) : 0;
    if (q.blankCount > 1 && zhBlanks > 0 && q.blankCount !== zhBlanks && !isTemplateZh) {
      blankMismatch++;
      high.push(`[blank-mismatch] blankCount=${q.blankCount} zh=${zhBlanks} — ${id}`);
    }

    // concept confusion in translations/explanations
    const allText = `${q.questionZh || ""} ${q.explanationZh || ""} ${q.explanationEn || ""}`;
    for (const rule of CONCEPT_RULES) {
      if (!rule.key.test(stem)) continue;
      for (const bad of rule.bad) {
        if (bad.test(allText)) {
          high.push(`[concept] ${rule.label} — ${id}`);
        }
      }
    }
  }

  console.log(`\n===== audit:translations =====`);
  console.log(`questions: ${data.length}`);
  console.log(`questionZh template/blank: ${emptyZh}`);
  console.log(`explanationZh template/blank: ${emptyExpZh}`);
  console.log(`explanationEn template/blank: ${emptyExpEn}`);
  console.log(`blank count mismatch: ${blankMismatch}`);
  console.log(`HIGH-RISK concept issues: ${high.filter(h => h.startsWith("[concept]")).length}`);
  console.log(`total HIGH-RISK: ${high.length}`);
  high.forEach((h) => console.log("  ✗ " + h));
  if (low.length) {
    console.log(`LOW-RISK / informational: ${low.length}`);
    low.slice(0, 8).forEach((l) => console.log("  · " + l));
    if (low.length > 8) console.log(`  …and ${low.length - 8} more`);
  }
  console.log(`==============================\n`);

  if (high.length > 0) { console.error("TRANSLATION AUDIT FAILED: high-risk issues present."); process.exit(1); }
  console.log("TRANSLATION AUDIT PASSED.");
}

run();
