// client/src/components/QuestionStats.tsx
// Doubles as the "stats" page and a study tool: aggregate counts over the whole
// deduped bank, plus a searchable, filterable list of every question + answer.
import { useEffect, useMemo, useState } from "react";
import type { Question } from "@shared/types";
import { loadQuestions } from "../game/systems/QuestionManager";
import { DifficultyChip } from "./ui";

export default function QuestionStats(props: { onBack: () => void }) {
  const [all, setAll] = useState<Question[] | null>(null);
  const [q, setQ] = useState("");
  const [chapter, setChapter] = useState<string>("all");

  useEffect(() => { loadQuestions().then(setAll); }, []);

  const agg = useMemo(() => {
    if (!all) return null;
    const byChapter = new Map<string, number>();
    const byYear = new Map<string, number>();
    const byTag = new Map<string, number>();
    const byDiff = new Map<string, number>();
    for (const item of all) {
      byChapter.set(item.chapter, (byChapter.get(item.chapter) ?? 0) + 1);
      byDiff.set(item.difficulty, (byDiff.get(item.difficulty) ?? 0) + 1);
      for (const y of item.years) byYear.set(y, (byYear.get(y) ?? 0) + 1);
      for (const t of item.tags) byTag.set(t, (byTag.get(t) ?? 0) + 1);
    }
    const sortDesc = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    const sortYear = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    return {
      total: all.length,
      blanks: all.reduce((s, x) => s + x.blankCount, 0),
      byChapter: sortDesc(byChapter),
      byYear: sortYear(byYear),
      byTag: sortDesc(byTag).slice(0, 8),
      byDiff,
    };
  }, [all]);

  const filtered = useMemo(() => {
    if (!all) return [];
    const term = q.trim().toLowerCase();
    return all.filter((item) => {
      if (chapter !== "all" && item.chapter !== chapter) return false;
      if (!term) return true;
      return (
        item.questionEn.toLowerCase().includes(term) ||
        item.answers.some((a) => a.toLowerCase().includes(term)) ||
        item.tags.some((t) => t.toLowerCase().includes(term))
      );
    });
  }, [all, q, chapter]);

  const chapters = useMemo(() => (agg ? ["all", ...agg.byChapter.map((c) => c[0])] : ["all"]), [agg]);

  return (
    <div className="stats-wrap float-in">
      <div className="row between" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 26 }}>Question Bank</h2>
        <button className="btn btn-ghost btn-sm" onClick={props.onBack}>← Back</button>
      </div>

      {!agg ? (
        <p className="muted pulse">Loading the grimoire…</p>
      ) : (
        <>
          <div className="stat-cards">
            <div className="panel stat-card">
              <div className="big-num">{agg.total}</div>
              <div className="faint">unique questions</div>
            </div>
            <div className="panel stat-card">
              <div className="big-num">{agg.blanks}</div>
              <div className="faint">total blanks</div>
            </div>
            <div className="panel stat-card">
              <div className="big-num">{agg.byYear.length}</div>
              <div className="faint">exam sittings</div>
            </div>
            <div className="panel stat-card">
              <div className="big-num">{agg.byChapter.length}</div>
              <div className="faint">chapters covered</div>
            </div>
          </div>

          <div className="dist-grid">
            <div className="panel dist-card">
              <span className="eyebrow">By chapter</span>
              <BarList data={agg.byChapter} max={Math.max(...agg.byChapter.map((c) => c[1]))} />
            </div>
            <div className="panel dist-card">
              <span className="eyebrow">Top topics</span>
              <BarList data={agg.byTag} max={Math.max(...agg.byTag.map((c) => c[1]))} accent="gold" />
            </div>
            <div className="panel dist-card">
              <span className="eyebrow">By exam year</span>
              <BarList data={agg.byYear} max={Math.max(...agg.byYear.map((c) => c[1]))} accent="violet" />
            </div>
          </div>

          <div className="panel browse-card">
            <div className="row wrap browse-controls" style={{ gap: 10 }}>
              <input
                className="input grow"
                placeholder="Search questions, answers, topics…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select className="select chapter-select" value={chapter} onChange={(e) => setChapter(e.target.value)}>
                {chapters.map((c) => (
                  <option key={c} value={c}>{c === "all" ? "All chapters" : c}</option>
                ))}
              </select>
            </div>
            <p className="faint" style={{ fontSize: 12, margin: "10px 2px" }}>
              {filtered.length} shown
            </p>
            <div className="browse-list">
              {filtered.slice(0, 120).map((item) => (
                <div key={item.id} className="browse-item">
                  <div className="row wrap" style={{ gap: 6, marginBottom: 6 }}>
                    <span className="chip teal">{item.chapter}</span>
                    {item.years[0] && <span className="chip gold">{item.years.join(" · ")}</span>}
                    <DifficultyChip d={item.difficulty} />
                    {item.tags.slice(0, 2).map((t) => <span key={t} className="chip">{t}</span>)}
                  </div>
                  <p className="browse-q">{item.questionEn}</p>
                  <p className="browse-a">
                    <span className="faint">Answer: </span>
                    <span className="gold-text">{item.answers.join("  ;  ")}</span>
                  </p>
                </div>
              ))}
              {filtered.length > 120 && (
                <p className="faint center" style={{ textAlign: "center" }}>Showing first 120 — refine your search to see more.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BarList({ data, max, accent }: { data: [string, number][]; max: number; accent?: "gold" | "violet" }) {
  const color = accent === "gold" ? "var(--gold)" : accent === "violet" ? "var(--violet)" : "var(--teal)";
  return (
    <div className="bar-list">
      {data.map(([label, n]) => (
        <div key={label} className="bar-row">
          <span className="bar-label" title={label}>{label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(n / max) * 100}%`, background: color }} />
          </span>
          <span className="bar-num">{n}</span>
        </div>
      ))}
    </div>
  );
}
