// client/src/components/Result.tsx
import type { MatchResult } from "./Battle";

const fmtMs = (ms: number | null) => (ms == null || ms <= 0 ? "—" : `${(ms / 1000).toFixed(1)}s`);
const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function Result(props: { result: MatchResult; onRematch: () => void; onMenu: () => void }) {
  const r = props.result;
  const verdict = r.meWon === null ? "Draw" : r.meWon ? "Victory" : "Defeat";
  const vClass = r.meWon === null ? "draw" : r.meWon ? "win" : "lose";

  const rows: { label: string; me: string; opp: string }[] = [
    { label: "Correct", me: `${r.me.correct}/${r.me.total}`, opp: `${r.opp.correct}/${r.opp.total}` },
    { label: "Accuracy", me: pct(r.me.accuracy), opp: pct(r.opp.accuracy) },
    { label: "Avg answer time", me: fmtMs(r.me.avgMs), opp: fmtMs(r.opp.avgMs) },
    { label: "Fastest cast", me: fmtMs(r.me.fastestMs), opp: fmtMs(r.opp.fastestMs) },
    { label: "Damage dealt", me: String(r.me.totalDamage), opp: String(r.opp.totalDamage) },
  ];

  return (
    <div className="result-wrap float-in">
      <div className={"verdict-banner " + vClass}>
        <span className="eyebrow">The duel is decided</span>
        <h1 className="title-xl">{verdict}</h1>
      </div>

      <div className="panel form-card">
        <div className="stat-table">
          <div className="stat-head row">
            <span className="grow" />
            <span className="stat-name you">{r.me.name}</span>
            <span className="stat-name">{r.opp.name}</span>
          </div>
          {rows.map((row) => (
            <div key={row.label} className="stat-row row">
              <span className="grow faint">{row.label}</span>
              <span className="stat-val you">{row.me}</span>
              <span className="stat-val">{row.opp}</span>
            </div>
          ))}
        </div>

        {r.me.wrong.length > 0 && (
          <>
            <hr className="hairline" />
            <span className="eyebrow">Review — what you missed</span>
            <div className="wrong-list">
              {r.me.wrong.map((w, i) => (
                <div key={i} className="wrong-item">
                  <p className="wrong-q">{w.questionEn}</p>
                  <div className="row wrap" style={{ gap: 14 }}>
                    <span><span className="faint">Correct: </span><span className="gold-text">{w.correctAnswers.join(" ; ")}</span></span>
                    {w.your.some((y) => y.trim()) && (
                      <span><span className="faint">You: </span><span className="bad-text">{w.your.join(" ; ") || "—"}</span></span>
                    )}
                  </div>
                  {w.explanationZh && (
                    <p className="wrong-explain" dangerouslySetInnerHTML={{ __html: w.explanationZh }} />
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="row" style={{ gap: 12, marginTop: 22 }}>
          <button className="btn btn-primary grow" onClick={props.onRematch}>Duel again</button>
          <button className="btn btn-ghost grow" onClick={props.onMenu}>Main menu</button>
        </div>
      </div>
    </div>
  );
}
