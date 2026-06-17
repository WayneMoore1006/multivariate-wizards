// client/src/components/QuestionGallery.tsx
// 題庫長廊 / Question Gallery — browse the deduped 18-year bank by chapter & year,
// search, toggle answer visibility, switch language, and drill into a "practice"
// (training) mode. Reads the project's OWN enriched /questions.json, so it needs
// no schema conversion — the enrichment step already merged the reference quiz
// content (questionZh / explanationZh / explanationEn / accepted variants).
import { useEffect, useMemo, useState } from "react";
import type { Question, LanguageMode } from "@shared/types";
import { explanationZhFor, explanationEnFor, questionZhFor } from "@shared/answerUtils";
import { loadQuestions } from "../game/systems/QuestionManager";
import { audio } from "../game/systems/AudioManager";

const CHAPTER_NAMES: Record<string, string> = {
  Ch5: "Multiple Regression · 多元迴歸",
  Ch6: "MANOVA & Experimental · MANOVA 與實驗設計",
  Ch7: "Discriminant Analysis · 判別分析",
  Ch8: "Logistic Regression",
  Ch9: "SEM · 結構方程模式",
  Ch10: "CFA · 驗證性因素分析",
  Ch11: "SEM Path · 路徑分析",
  Ch12: "Scales · 量表",
};

// Numeric chapter ordering — extracts the number from "Ch7", "Exercise_Ch6", etc.
// so Ch10 sorts AFTER Ch9 (never string-sorted). Unknown formats sink to the end.
function getChapterNumber(label: string): number {
  const m = String(label).match(/Ch\s*(\d+)/i);
  return m ? Number(m[1]) : 999;
}

export default function QuestionGallery(props: { uiLang: LanguageMode; onBack: () => void }) {
  const [all, setAll] = useState<Question[] | null>(null);
  const [chapter, setChapter] = useState<string>("ALL");
  const [year, setYear] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [lang, setLang] = useState<LanguageMode>(props.uiLang);
  const [showAnswers, setShowAnswers] = useState(true);
  const [practice, setPractice] = useState(false);

  useEffect(() => { loadQuestions().then(setAll); }, []);

  const chapters = useMemo(() => {
    if (!all) return [];
    const present = Array.from(new Set(all.map((q) => q.chapter)));
    return present.sort((a, b) => getChapterNumber(a) - getChapterNumber(b));
  }, [all]);

  const years = useMemo(() => {
    if (!all) return [];
    const set = new Set<string>();
    all.forEach((q) => q.years.forEach((y) => set.add(y)));
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [all]);

  const filtered = useMemo(() => {
    if (!all) return [];
    const s = search.trim().toLowerCase();
    return all.filter((q) => {
      if (chapter !== "ALL" && q.chapter !== chapter) return false;
      if (year !== "ALL" && !q.years.includes(year)) return false;
      if (!s) return true;
      const hay = (q.questionEn + " " + q.questionZh + " " + q.answers.join(" ") + " " + q.tags.join(" ")).toLowerCase();
      return hay.includes(s);
    });
  }, [all, chapter, year, search]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    (all ?? []).forEach((q) => { m[q.chapter] = (m[q.chapter] ?? 0) + 1; });
    return m;
  }, [all]);

  return (
    <div className="gallery-wrap float-in">
      <div className="gallery-top row between">
        <div className="row" style={{ gap: 12, alignItems: "baseline" }}>
          <h2 className="gallery-title">歷史長廊 <span className="faint" style={{ fontSize: 15 }}>· History Gallery</span></h2>
          <span className="chip teal">{all ? all.length : "—"} questions</span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div className="seg">
            {(["en", "en_zh", "zh"] as LanguageMode[]).map((l) => (
              <button key={l} className={"opt" + (l === lang ? " active" : "")} onClick={() => setLang(l)} type="button">
                {l === "en" ? "EN" : l === "zh" ? "中" : "EN+中"}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={props.onBack}>← Menu</button>
        </div>
      </div>

      <div className="gallery-shell">
        {/* sidebar */}
        <aside className="gallery-aside panel">
          <div className="aside-label">章節 · Chapters</div>
          <button className={"topic-btn" + (chapter === "ALL" ? " active" : "")} onClick={() => setChapter("ALL")}>
            <span>All chapters</span><span className="tbadge">{all?.length ?? 0}</span>
          </button>
          {chapters.map((c) => (
            <button key={c} className={"topic-btn" + (chapter === c ? " active" : "")} onClick={() => setChapter(c)}>
              <span>{c}</span><span className="tbadge">{counts[c] ?? 0}</span>
            </button>
          ))}

          <div className="aside-label" style={{ marginTop: 18 }}>年份 · Years</div>
          <div className="year-chips">
            <button className={"ychip" + (year === "ALL" ? " active" : "")} onClick={() => setYear("ALL")}>All</button>
            {years.map((y) => (
              <button key={y} className={"ychip" + (year === y ? " active" : "")} onClick={() => setYear(y)}>{y}</button>
            ))}
          </div>

          <div className="aside-label" style={{ marginTop: 18 }}>模式 · Mode</div>
          <label className="gallery-check">
            <input type="checkbox" checked={practice} onChange={(e) => { setPractice(e.target.checked); setShowAnswers(!e.target.checked); }} />
            <span>練習模式 Practice (hide answers, tap to reveal)</span>
          </label>
          <label className="gallery-check">
            <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} disabled={practice} />
            <span>顯示答案 Show answers</span>
          </label>
        </aside>

        {/* main */}
        <div className="gallery-main">
          <input
            className="input gallery-search"
            placeholder="搜尋題目、答案、關鍵字… / Search question, answer, keyword…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="faint" style={{ margin: "8px 2px 14px" }}>{filtered.length} result(s)</div>

          {!all && <p className="muted pulse">Loading the bank…</p>}

          <div className="gallery-grid">
            {filtered.map((q) => (
              <GalleryCard key={q.id} q={q} lang={lang} showAnswers={showAnswers} practice={practice} />
            ))}
          </div>
          {all && filtered.length === 0 && <p className="muted" style={{ textAlign: "center", padding: 40 }}>No questions match these filters.</p>}
        </div>
      </div>
    </div>
  );
}

function GalleryCard({ q, lang, showAnswers, practice }: { q: Question; lang: LanguageMode; showAnswers: boolean; practice: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const show = showAnswers || revealed;
  const zh = questionZhFor(q);
  const expZh = explanationZhFor(q);
  const expEn = explanationEnFor(q);

  return (
    <div className="gallery-card panel">
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <span className="chip teal">{q.chapter}</span>
          {q.years.slice(0, 6).map((y) => <span key={y} className="qchip-year">{y}</span>)}
          {q.isMakeupExam && <span className="chip gold">補考</span>}
          <span className={"chip " + q.difficulty}>{q.difficulty}</span>
        </div>
        <span className="faint" style={{ fontSize: 12 }}>{q.blankCount} blank{q.blankCount > 1 ? "s" : ""}</span>
      </div>

      {lang !== "zh" && <p className="q-text" style={{ marginBottom: 6 }}>{q.questionEn}</p>}
      {lang !== "en" && <p className="q-text zh" style={{ marginBottom: 6 }}>{zh}</p>}

      {practice && !revealed ? (
        <button className="btn btn-gold btn-sm" onClick={() => setRevealed(true)}>顯示答案 / Reveal</button>
      ) : show ? (
        <>
          <div className="reveal-answers" style={{ marginTop: 6 }}>
            {q.answers.map((a, i) => (
              <div key={i} className="reveal-line">
                <span className="faint">Answer{q.answers.length > 1 ? ` ${i + 1}` : ""}:</span>{" "}
                <span className="gold-text">{a}</span>
                {q.acceptedAnswers[i] && q.acceptedAnswers[i].length > 1 && (
                  <span className="faint accepts"> · accepts: {q.acceptedAnswers[i].join(", ")}</span>
                )}
              </div>
            ))}
          </div>
          {q.answerNote && <div className="answer-note">來源 / source：{q.answerNote}</div>}
          <div className="reveal-explain" style={{ marginTop: 8 }}>
            <span className="explain-label">中文解釋 · Why</span>
            <p className="explain-zh" dangerouslySetInnerHTML={{ __html: expZh }} />
            {lang === "en_zh" && expEn && <p className="explain-en" dangerouslySetInnerHTML={{ __html: expEn }} />}
          </div>
        </>
      ) : (
        <button className="btn btn-ghost btn-sm" onClick={() => setRevealed(true)}>顯示答案 / Show answer</button>
      )}
    </div>
  );
}
