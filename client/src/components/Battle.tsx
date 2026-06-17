// client/src/components/Battle.tsx
// Unified battle screen for BOTH 1vBot and online play. Phaser draws the duel;
// React owns the answer inputs, timer readout, language toggle and the per-round
// reveal overlay. Everything is driven by the shared EventBus, so this one
// component serves both modes — bot mode just passes an empty roomCode.
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameSettings, LanguageMode, WizardKind } from "@shared/types";
import { explanationZhFor, explanationEnFor, questionZhFor } from "@shared/answerUtils";
import { bus, EV } from "../game/EventBus";
import { audio } from "../game/systems/AudioManager";
import PhaserBattle from "../PhaserBattle";
import type { BattleInit } from "../game/scenes/BattleScene";
import { wizardMeta, DifficultyChip } from "./ui";

export interface MatchResult {
  meWon: boolean | null;
  me: SidePlayer;
  opp: SidePlayer;
}
export interface SidePlayer {
  name: string;
  correct: number;
  total: number;
  accuracy: number;
  avgMs: number;
  fastestMs: number | null;
  totalDamage: number;
  wrong: { questionEn: string; questionZh?: string; correctAnswers: string[]; your: string[]; explanationZh?: string }[];
}

interface RoundInfo {
  index: number;
  total: number;
  questionId: string;
  questionEn: string;
  questionZh: string;
  chapter: string;
  years: string[];
  difficulty: "easy" | "normal" | "hard";
  blankCount: number;
  endsAtMs: number;
  roundTimeLimit: number;
}

interface Reveal {
  correctAnswers: string[];
  acceptedAnswers: string[][];
  meCorrect: boolean;
  yourBlanks: string[];
  meDamage: number;
  oppDamage: number;
  combo: number;
  attackType: "normal" | "triple" | "grand";
  attackLabel: string;
  attackLabelZh: string;
  multiplier: number;
  baseDamage: number;
  comboBroken: boolean;
  meMs: number | null;
  practice: boolean;
  awaitNext: boolean;
  explanationZh: string;
  explanationEn: string;
  chapter: string;
  years: string[];
  answerNote: string;
}

export default function Battle(props: {
  meName: string;
  meWizard: WizardKind;
  oppName: string;
  oppWizard: WizardKind;
  settings: GameSettings;
  roomCode?: string; // empty/undefined for bot mode
  onGameOver: (r: MatchResult) => void;
  onQuit: () => void;
}) {
  const { settings } = props;
  const init: BattleInit = useMemo(
    () => ({
      meName: props.meName,
      meWizard: props.meWizard,
      oppName: props.oppName,
      oppWizard: props.oppWizard,
      maxHp: 100,
      showChapter: settings.showChapterTag,
      showYear: settings.showYearTag,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [round, setRound] = useState<RoundInfo | null>(null);
  const [blanks, setBlanks] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [msLeft, setMsLeft] = useState(0);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [lang, setLang] = useState<LanguageMode>(settings.languageMode);
  const firstInput = useRef<HTMLInputElement>(null);
  const isBot = !props.roomCode;

  useEffect(() => {
    const offs: (() => void)[] = [];

    offs.push(
      bus.on(EV.ROUND_START, (d: any) => {
        audio.unlock();
        audio.bgm("battle");
        setReveal(null);
        setSubmitted(false);
        setTimeUp(false);
        setRound({
          index: d.index,
          total: d.total,
          questionId: d.question.id,
          questionEn: d.question.questionEn,
          questionZh: d.question.questionZh,
          chapter: d.question.chapter,
          years: d.question.years ?? [],
          difficulty: d.question.difficulty,
          blankCount: d.question.blankCount,
          endsAtMs: d.endsAtMs,
          roundTimeLimit: d.roundTimeLimit ?? 30,
        });
        setBlanks(Array.from({ length: d.question.blankCount }, () => ""));
        setTimeout(() => firstInput.current?.focus(), 60);
      })
    );

    offs.push(bus.on(EV.TICK, (d: { msLeft: number }) => setMsLeft(d.msLeft)));

    offs.push(bus.on(EV.TIME_UP, () => setTimeUp(true)));

    offs.push(
      bus.on(EV.ROUND_RESULT, (d: any) => {
        const q = { chapter: d.chapter ?? "", answers: d.correctAnswers ?? [], explanationZh: d.explanationZh, explanationEn: d.explanationEn };
        setReveal({
          correctAnswers: d.correctAnswers,
          acceptedAnswers: d.acceptedAnswers ?? [],
          meCorrect: d.me?.correct ?? false,
          yourBlanks: d.me?.blanks ?? [],
          meDamage: d.me?.damage ?? 0,
          oppDamage: d.opp?.damage ?? 0,
          combo: d.me?.combo ?? 0,
          attackType: d.me?.attackType ?? "normal",
          attackLabel: d.me?.attackLabel ?? "",
          attackLabelZh: d.me?.attackLabelZh ?? "",
          multiplier: d.me?.multiplier ?? 1,
          baseDamage: d.me?.baseDamage ?? 0,
          comboBroken: d.comboBroken ?? false,
          meMs: d.me?.ms ?? null,
          practice: d.practice ?? d.me?.practice ?? false,
          awaitNext: d.awaitNext ?? false,
          explanationZh: explanationZhFor(q),
          explanationEn: explanationEnFor(q),
          chapter: d.chapter ?? "",
          years: d.years ?? [],
          answerNote: d.answerNote ?? "",
        });
      })
    );

    offs.push(
      bus.on(EV.GAME_OVER, (d: any) => {
        if (d.summary) {
          // bot mode carries a full BattleSummary
          const s = d.summary;
          props.onGameOver({ meWon: s.meWon, me: s.me, opp: s.bot });
        }
        // online mode resolves via its own GameOverPayload handler in the lobby
      })
    );

    return () => offs.forEach((o) => o());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setBlank = (i: number, v: string) =>
    setBlanks((b) => b.map((x, j) => (j === i ? v : x)));

  const submit = () => {
    if (submitted || !round) return;
    if (blanks.every((b) => b.trim() === "")) return;
    setSubmitted(true);
    audio.unlock();
    audio.sfx("click");
    bus.emit(EV.SUBMIT, {
      blanks,
      roomCode: props.roomCode ?? "",
      questionId: round.questionId,
    });
  };

  const showAnswer = () => {
    if (reveal) return;
    audio.sfx("click");
    bus.emit(EV.REVEAL, {});
  };

  const nextQuestion = () => {
    audio.sfx("click");
    bus.emit(EV.NEXT, {});
  };

  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "Enter") {
      if (i < blanks.length - 1) {
        const next = document.getElementById(`blank-${i + 1}`) as HTMLInputElement | null;
        next?.focus();
      } else {
        submit();
      }
    }
  };

  const secs = Math.ceil(msLeft / 1000);
  const lowTime = msLeft < 6000 && msLeft > 0;
  const meta = wizardMeta(props.meWizard);

  return (
    <div className="battle-screen float-in">
      <div className="battle-topbar row between">
        <div className="row" style={{ gap: 12 }}>
          <span className="eyebrow">Round {round ? round.index + 1 : "—"} / {round?.total ?? settings.questionCount}</span>
          {round && settings.showChapterTag && <span className="chip teal">{round.chapter}</span>}
          {round && settings.showYearTag && round.years[0] && <span className="chip gold">{round.years.join(" · ")}</span>}
          {round && <DifficultyChip d={round.difficulty} />}
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div className="lang-toggle seg">
            {(["en", "en_zh", "zh"] as LanguageMode[]).map((l) => (
              <button key={l} className={"opt" + (l === lang ? " active" : "")} onClick={() => setLang(l)} type="button">
                {l === "en" ? "EN" : l === "zh" ? "中" : "EN+中"}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={props.onQuit}>Forfeit</button>
        </div>
      </div>

      <div className="battle-stage panel">
        <PhaserBattle init={init} />
      </div>

      {/* question + answer dock */}
      <div className="answer-dock panel">
        {round ? (
          <>
            <div className="row between" style={{ marginBottom: 10 }}>
              <span className="eyebrow">Fill the blanks to cast</span>
              <span className={"timer-mono" + (lowTime ? " low" : "")}>{secs > 0 ? secs : 0}s</span>
            </div>

            {lang !== "zh" && <p className="q-text">{round.questionEn}</p>}
            {lang !== "en" && (
              <p className="q-text zh">{questionZhFor({ questionZh: round.questionZh, questionEn: round.questionEn })}</p>
            )}

            {isBot && timeUp && !reveal && (
              <div className="timeup-banner row between">
                <span className="timeup-text">⏳ 時間到！Time's up — 你仍可作答練習（答對只給 1 點傷害）</span>
                <button className="btn btn-gold btn-sm" onClick={showAnswer}>顯示答案 / Show answer</button>
              </div>
            )}

            <div className="blank-row">
              {blanks.map((b, i) => {
                const ok = reveal ? matchedLocally(reveal, i, b) : null;
                return (
                  <input
                    key={i}
                    id={`blank-${i}`}
                    ref={i === 0 ? firstInput : undefined}
                    className={"input blank-input" + (ok === true ? " ok" : ok === false ? " bad" : "")}
                    placeholder={blanks.length > 1 ? `blank ${i + 1}` : "your answer"}
                    value={b}
                    disabled={submitted || !!reveal}
                    onChange={(e) => setBlank(i, e.target.value)}
                    onKeyDown={(e) => onKey(e, i)}
                    autoComplete="off"
                  />
                );
              })}
              <button className="btn btn-primary" onClick={submit} disabled={submitted || !!reveal}>
                {submitted && !reveal ? "Cast!" : timeUp ? "Practice" : "Cast"}
              </button>
            </div>
          </>
        ) : (
          <p className="muted pulse" style={{ textAlign: "center", padding: "18px 0" }}>
            Summoning the arena…
          </p>
        )}
      </div>

      {/* reveal overlay */}
      {reveal && round && (
        <div className="reveal float-in panel">
          <div className="row between">
            <span className={"reveal-verdict " + (reveal.meCorrect ? "good" : "bad")}>
              {reveal.meCorrect ? (reveal.practice ? "Practice · correct" : "Spell landed") : "Fizzled"}
            </span>
            <div className="row" style={{ gap: 8 }}>
              {isBot && reveal.chapter && <span className="chip teal">{reveal.chapter}</span>}
              {isBot && reveal.years[0] && <span className="chip gold">{reveal.years.join(" · ")}</span>}
              {reveal.comboBroken && <span className="chip broken">連擊中斷 · Combo Broken</span>}
              {reveal.combo > 0 && reveal.attackType === "triple" && <span className="chip triple">⚡ Combo ×{reveal.combo} · 三連詠唱 ×1.15</span>}
              {reveal.combo > 0 && reveal.attackType === "grand" && <span className="chip grand">★ Combo ×{reveal.combo} · 大型咒術 ×1.25</span>}
              {reveal.combo > 1 && reveal.attackType === "normal" && <span className="chip teal">Combo ×{reveal.combo}</span>}
            </div>
          </div>

          <div className="reveal-answers">
            {reveal.correctAnswers.map((a, i) => (
              <div key={i} className="reveal-line">
                <span className="faint">Answer{reveal.correctAnswers.length > 1 ? ` ${i + 1}` : ""}:</span>{" "}
                <span className="gold-text">{a}</span>
                {reveal.acceptedAnswers[i] && reveal.acceptedAnswers[i].length > 1 && (
                  <span className="faint accepts"> · accepts: {reveal.acceptedAnswers[i].join(", ")}</span>
                )}
              </div>
            ))}
          </div>
          {reveal.answerNote && (
            <div className="answer-note">來源 / source：{reveal.answerNote}</div>
          )}
          <div className="row wrap" style={{ gap: 16, marginTop: 4 }}>
            {reveal.yourBlanks.some((y) => y.trim()) ? (
              <span><span className="faint">你的作答 / Your answer: </span>
                <span className={reveal.meCorrect ? "gold-text" : "bad-text"}>{reveal.yourBlanks.join(" ; ")}</span>
              </span>
            ) : <span className="faint">未作答 / no answer</span>}
            {reveal.meMs != null && <span className="faint">答題時間 / time: {(reveal.meMs / 1000).toFixed(1)}s</span>}
          </div>

          {/* Chinese explanation (always shown, with EN underneath when EN+中) */}
          <div className="reveal-explain">
            <span className="explain-label">中文解釋 · Why</span>
            <p className="explain-zh" dangerouslySetInnerHTML={{ __html: reveal.explanationZh }} />
            {lang === "en_zh" && reveal.explanationEn && (
              <p className="explain-en" dangerouslySetInnerHTML={{ __html: reveal.explanationEn }} />
            )}
          </div>

          <div className="row between" style={{ marginTop: 8 }}>
            <div className="row" style={{ gap: 16 }}>
              {reveal.meDamage > 0 && (
                <span className="dmg-out">
                  you dealt {reveal.meDamage}
                  {reveal.practice ? " (practice)" : reveal.multiplier > 1
                    ? ` · base ${reveal.baseDamage} × ${reveal.multiplier} ${reveal.attackType === "grand" ? "Grand" : "Triple"}`
                    : ""}
                </span>
              )}
              {reveal.oppDamage > 0 && <span className="dmg-in">you took {reveal.oppDamage}</span>}
              {reveal.meDamage === 0 && reveal.oppDamage === 0 && <span className="faint">no damage this round</span>}
            </div>
            {isBot && reveal.awaitNext && (
              <button className="btn btn-primary" onClick={nextQuestion}>下一題 / Next →</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// light client-side per-blank correctness hint for the reveal coloring
function matchedLocally(reveal: Reveal, i: number, value: string): boolean | null {
  const norm = (s: string) => s.toLowerCase().replace(/[\s'’.,;:()]/g, "").replace(/²/g, "2");
  const accepted = reveal.acceptedAnswers[i] ?? [reveal.correctAnswers[i]];
  if (!accepted) return null;
  return accepted.some((a) => norm(a) === norm(value));
}
