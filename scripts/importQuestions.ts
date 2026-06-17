// ============================================================================
// scripts/importQuestions.ts
// Reads the docx exam bank and produces the JSON used by the game.
//
//   npm run import:questions
//
// Outputs (into ./data):
//   questions.raw.json        every parsed question, before dedupe
//   questions.deduped.json    merged-by-knowledge-point questions
//   questions.bilingual.json  deduped + questionZh filled in
//   import-warnings.json      questions that parsed oddly
//   duplicate-report.json     which questions got merged
//
// If the docx cannot be parsed, the game still works from data/seedQuestions.json.
// ============================================================================
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import mammoth from "mammoth";
import { foldDisplay, normalizeAnswer, stripAnswerNote } from "../shared/answerUtils";
import { dedupeQuestions } from "./dedupeQuestions";
import { buildBilingual } from "./translateQuestions";
import { enrichFromReference } from "./enrichFromReference";
import { applyCorrections } from "./answerCorrections";
import type { Question, Difficulty } from "../shared/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");

// docx may live in a couple of places depending on the checkout
const DOCX_CANDIDATES = [
  path.join(ROOT, "多變量期末_終極大考古_涵蓋18年來所有試題.docx"),
  path.join(ROOT, "data", "多變量期末_終極大考古_涵蓋18年來所有試題.docx"),
  process.env.DOCX_PATH ?? "",
].filter(Boolean);

interface Warning { id: string; sourceLabel: string; reason: string; raw: string; }

const warnings: Warning[] = [];
let qCounter = 0;

// ---- blank detection ------------------------------------------------------
const BLANK_PATTERNS = [/_{3,}/g, /\u2574{2,}/g, /\u2500{2,}/g, /\u2024{2,}/g];
function countBlanks(questionText: string, answerBlankCount: number): number {
  let count = 0;
  for (const re of BLANK_PATTERNS) {
    const m = questionText.match(re);
    if (m) count += m.length;
  }
  if (count === 0) return Math.max(1, answerBlankCount); // looks like fill-in but no marker found
  return count;
}

// ---- answer parsing -------------------------------------------------------
// "; " separates blanks; " / " separates accepted variants within a blank.
function parseAnswerToBlanks(answerText: string): { answers: string[]; accepted: string[][]; rawAnswer: string; answerNote: string } {
  const folded = foldDisplay(answerText);
  const rawAnswer = folded.trim();
  const blanks = folded.split(";").map((s) => s.trim()).filter(Boolean);
  const list = blanks.length ? blanks : [folded.trim()];
  const notes = new Set<string>();
  // split variants on "/", then strip textbook/page/remark notes from EACH variant.
  // Meaningful parens (synonyms / abbreviations) are preserved by stripAnswerNote.
  const accepted = list.map((b) =>
    b.split("/").map((s) => {
      const { clean, note } = stripAnswerNote(s.trim());
      if (note) notes.add(note);
      return clean;
    }).filter(Boolean)
  );
  const answers = accepted.map((variants) => variants[0] ?? "");
  return { answers, accepted, rawAnswer, answerNote: [...notes].join("; ") };
}

// ---- chapter + tags -------------------------------------------------------
function detectChapter(questionText: string, sectionChapter: string | null): string {
  const m = questionText.match(/\(((?:Ch\d+\s*\/?\s*)+|Canonical correlation)\)/i);
  if (m) return m[1].replace(/\s+/g, "");
  return sectionChapter ?? "General";
}

const TAG_RULES: { re: RegExp; tag: string }[] = [
  { re: /discriminant/i, tag: "Discriminant Analysis" },
  { re: /manova|hotelling|wilks|pillai|roy|covariate|factorial|contrast|treatment/i, tag: "MANOVA" },
  { re: /regression|collinearity|vif|tolerance|beta|backward/i, tag: "Multiple Regression" },
  { re: /canonical/i, tag: "Canonical Correlation" },
  { re: /sem|latent|structural model|path analysis/i, tag: "SEM" },
  { re: /cfa|confirmatory|ave|construct validity|formative/i, tag: "CFA" },
  { re: /hit ratio|classification|holdout/i, tag: "Classification" },
];
function detectTags(text: string): string[] {
  const tags = TAG_RULES.filter((r) => r.re.test(text)).map((r) => r.tag);
  return tags.length ? Array.from(new Set(tags)) : ["General"];
}

function difficultyFor(blankCount: number, chapter: string): Difficulty {
  if (blankCount >= 3) return "hard";
  if (blankCount === 2) return "normal";
  if (/canonical|sem|cfa/i.test(chapter)) return "normal";
  return "easy";
}

// ---- section header detection --------------------------------------------
interface SectionInfo { years: string[]; isMakeup: boolean; chapter: string | null; label: string; }
function parseSection(line: string): SectionInfo | null {
  const t = foldDisplay(line);
  if (/^Exercise[_\s]*Ch\s*6/i.test(t)) return { years: [], isMakeup: false, chapter: "Ch6", label: "Exercise_Ch6" };
  if (/^Exercise[_\s]*Ch\s*7/i.test(t)) return { years: [], isMakeup: false, chapter: "Ch7", label: "Exercise_Ch7" };
  const exam = t.match(/期末考試題\s*([0-9]{4})(?:\s*[&~]\s*([0-9]{4}))?\s*(\(?\s*補考\s*\)?)?/);
  if (exam) {
    const years = [exam[1]];
    if (exam[2]) {
      // expand ranges like 2002 ~ 2008 to endpoints; "2022 &2021" -> both
      const a = parseInt(exam[1], 10), b = parseInt(exam[2], 10);
      if (Math.abs(a - b) > 1) years.push(exam[2]);
      else years.push(exam[2]);
    }
    const isMakeup = !!exam[3];
    const label = isMakeup ? `${exam[1]}(補考)` : years.join("&");
    return { years: Array.from(new Set(years)), isMakeup, chapter: null, label };
  }
  return null;
}

const ANSWER_RE = /^\s*(?:Answer|𝐀𝐧𝐬𝐰𝐞𝐫)\s*[:：]/i;
function isAnswerLine(line: string): boolean {
  return ANSWER_RE.test(foldDisplay(line));
}
const QNUM_RE = /^\s*(\d{1,3})\s*\.\s+(.*)$/;

// ---- main parse -----------------------------------------------------------
function parseDocxText(text: string): Question[] {
  const rawLines = text.split(/\r?\n/);
  const questions: Question[] = [];

  let section: SectionInfo | null = null;
  let pendingQ: { num: string; text: string } | null = null;

  const flush = (answerLine: string) => {
    if (!pendingQ || !section) return;
    qCounter++;
    const id = `q_${String(qCounter).padStart(4, "0")}`;
    const qText = foldDisplay(pendingQ.text);
    const { answers, accepted, rawAnswer, answerNote } = parseAnswerToBlanks(answerLine.replace(ANSWER_RE, ""));
    const chapter = detectChapter(pendingQ.text, section.chapter);
    const blankCount = countBlanks(pendingQ.text, answers.length);

    if (answers.length !== blankCount) {
      warnings.push({
        id, sourceLabel: section.label,
        reason: `blankCount(${blankCount}) != answerCount(${answers.length})`,
        raw: `${qText}  ||  ${foldDisplay(answerLine)}`,
      });
    }
    if (!answers.length || answers.every((a) => !a)) {
      warnings.push({ id, sourceLabel: section.label, reason: "empty answer", raw: qText });
    }

    const cleanQuestion = qText.replace(/\((?:Ch\d+\s*\/?\s*)+\)|\(Canonical correlation\)/gi, "").trim();
    questions.push({
      id, chapter,
      years: section.years.slice(),
      sourceLabels: [section.label],
      questionEn: cleanQuestion,
      questionZh: "",
      answers,
      acceptedAnswers: accepted,
      ...(answerNote ? { rawAnswer, answerNote } : {}),
      blankCount,
      difficulty: difficultyFor(blankCount, chapter),
      tags: detectTags(qText + " " + answers.join(" ")),
      isMakeupExam: section.isMakeup,
      canonicalQuestion: cleanQuestion,
      duplicateGroupId: "",
    });
    pendingQ = null;
  };

  for (const line of rawLines) {
    const t = line.trim();
    if (!t) continue;

    const sec = parseSection(line);
    if (sec) { section = sec; pendingQ = null; continue; }
    if (!section) continue; // skip title/intro before first section

    if (isAnswerLine(line)) { flush(line); continue; }

    const qm = foldDisplay(line).match(QNUM_RE);
    if (qm) {
      // a new numbered question starts; if a previous one had no answer, warn
      if (pendingQ) {
        warnings.push({ id: `q_pending`, sourceLabel: section.label, reason: "question had no answer line", raw: pendingQ.text });
      }
      pendingQ = { num: qm[1], text: qm[2] };
      continue;
    }
    // continuation of a multi-line question
    if (pendingQ) pendingQ.text += " " + t;
  }
  return questions;
}

// ---- seed fallback --------------------------------------------------------
function loadSeed(): Question[] {
  const p = path.join(DATA, "seedQuestions.json");
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  return [];
}

function readDocx(): string | null {
  for (const c of DOCX_CANDIDATES) {
    if (fs.existsSync(c)) {
      try {
        // mammoth is async; we resolve synchronously via deasync-free trick below
        return c;
      } catch { /* try next */ }
    }
  }
  return null;
}

async function main() {
  fs.mkdirSync(DATA, { recursive: true });
  let raw: Question[] = [];
  const docxPath = readDocx();

  if (docxPath) {
    try {
      const res = await mammoth.extractRawText({ path: docxPath });
      raw = parseDocxText(res.value);
      console.log(`✓ Parsed docx: ${docxPath}`);
    } catch (e) {
      console.error("✗ docx parse failed, falling back to seed:", (e as Error).message);
    }
  } else {
    console.warn("! docx not found in any known location, falling back to seed.");
  }

  if (!raw.length) {
    raw = loadSeed();
    if (!raw.length) {
      console.error("No questions parsed and no seed available. Aborting without breaking the game.");
      return;
    }
    console.log(`Using ${raw.length} seed questions.`);
  }

  const { deduped, report } = dedupeQuestions(raw);
  // bilingual enrichment first (fills zh/explanation), THEN surgical corrections
  // run LAST so their exact answers + Chinese always win over any fuzzy match.
  const { questions: enrichedBase, matched } = enrichFromReference(deduped);
  const { questions: enriched, applied } = applyCorrections(enrichedBase);
  const bilingual = buildBilingual(enriched);
  console.log(`Answer corrections applied: ${applied.length}`);
  console.log(`Reference-enriched (zh/explanation): ${matched}/${enriched.length}`);

  fs.writeFileSync(path.join(DATA, "questions.raw.json"), JSON.stringify(raw, null, 2));
  fs.writeFileSync(path.join(DATA, "questions.deduped.json"), JSON.stringify(enriched, null, 2));
  fs.writeFileSync(path.join(DATA, "questions.bilingual.json"), JSON.stringify(bilingual, null, 2));
  fs.writeFileSync(path.join(DATA, "import-warnings.json"), JSON.stringify(warnings, null, 2));
  fs.writeFileSync(path.join(DATA, "duplicate-report.json"), JSON.stringify(report, null, 2));

  // Publish a copy the client can load statically (1vBot + stats work without server)
  const pub = path.join(ROOT, "client", "public");
  fs.mkdirSync(pub, { recursive: true });
  fs.writeFileSync(path.join(pub, "questions.json"), JSON.stringify(bilingual));

  // ---- stats ----
  const byChapter: Record<string, number> = {};
  const byYear: Record<string, number> = {};
  const byTag: Record<string, number> = {};
  for (const q of deduped) {
    byChapter[q.chapter] = (byChapter[q.chapter] ?? 0) + 1;
    for (const y of q.years.length ? q.years : ["Exercise"]) byYear[y] = (byYear[y] ?? 0) + 1;
    for (const tag of q.tags) byTag[tag] = (byTag[tag] ?? 0) + 1;
  }
  const topTags = Object.entries(byTag).sort((a, b) => b[1] - a[1]).slice(0, 5);

  console.log("\n================ IMPORT SUMMARY ================");
  console.log(`Raw questions parsed : ${raw.length}`);
  console.log(`Deduped questions    : ${deduped.length}`);
  console.log(`Duplicate groups     : ${report.length}`);
  console.log(`Parse warnings       : ${warnings.length}`);
  console.log("\nPer chapter:");
  Object.entries(byChapter).sort().forEach(([k, v]) => console.log(`  ${k.padEnd(22)} ${v}`));
  console.log("\nPer year/source:");
  Object.entries(byYear).sort().forEach(([k, v]) => console.log(`  ${k.padEnd(22)} ${v}`));
  console.log("\nTop knowledge points:");
  topTags.forEach(([k, v]) => console.log(`  ${k.padEnd(22)} ${v}`));
  console.log("================================================\n");
}

main().catch((e) => { console.error("Import crashed:", e); process.exit(1); });
