// client/src/game/systems/BattleManager.ts
// Local 1vBot engine. Emits the SAME EventBus events the online mode does,
// so the Phaser scene and React UI are identical across modes.
//
// Bot-mode round lifecycle (updated):
//   ROUND_START → (player submits in time)  → resolve()  → wait for NEXT
//                → (timer hits 0)            → TIME_UP    → player may:
//                       · type a PRACTICE answer (submit) → resolve(practice)
//                       · press "Show answer" (REVEAL)    → resolve(no answer)
//   Nothing auto-advances; the player must emit NEXT to move on.
import type { GameSettings, Question, Difficulty } from "@shared/types";
import { checkAnswer } from "@shared/answerUtils";
import { computeDamageDetailed, getComboPattern, getRoundTimeLimitByBlankCount, type AttackType } from "@shared/gameLogic";
import { bus, EV } from "../EventBus";
import { audio } from "./AudioManager";

interface BotProfile { minS: number; maxS: number; correctP: number; }
const BOT: Record<Difficulty, BotProfile> = {
  easy: { minS: 18, maxS: 28, correctP: 0.5 },
  normal: { minS: 10, maxS: 22, correctP: 0.7 },
  hard: { minS: 5, maxS: 15, correctP: 0.85 },
};

export interface BattleSummary { meWon: boolean | null; me: PlayerStat; bot: PlayerStat; }
export interface PlayerStat {
  name: string; correct: number; total: number; accuracy: number;
  avgMs: number; fastestMs: number | null; totalDamage: number;
  wrong: { questionEn: string; questionZh?: string; correctAnswers: string[]; your: string[]; explanationZh?: string }[];
}

export class BattleManager {
  private idx = -1;
  private hpMe = 100; private hpBot = 100;
  private comboMe = 0; private comboBot = 0;
  private settings: GameSettings;
  private questions: Question[];
  private roundStart = 0;
  private tickTimer?: number;
  private roundLimitS = 30; // per-question countdown, set from blankCount each round
  private submitted = false;       // player has submitted (in-time OR practice) this round
  private timeUp = false;          // timer reached 0
  private resolved = false;        // round result computed
  private playerBlanks: string[] | null = null;
  private playerMs = 0;
  private botAnswerMs = Infinity;
  private botCorrect = false;
  private statMe: PlayerStat;
  private statBot: PlayerStat;
  private offs: (() => void)[] = [];
  private ended = false;

  constructor(settings: GameSettings, questions: Question[], private meName: string, private botName: string) {
    this.settings = settings;
    this.questions = questions.slice(0, settings.questionCount);
    this.settings.questionCount = this.questions.length;
    this.statMe = this.mkStat(meName);
    this.statBot = this.mkStat(botName);
    this.offs.push(bus.on(EV.SUBMIT, (d: { blanks: string[] }) => this.onSubmit(d.blanks)));
    this.offs.push(bus.on(EV.REVEAL, () => this.onReveal()));
    this.offs.push(bus.on(EV.NEXT, () => this.onNext()));
  }

  private mkStat(name: string): PlayerStat {
    return { name, correct: 0, total: 0, accuracy: 0, avgMs: 0, fastestMs: null, totalDamage: 0, wrong: [] };
  }

  start() {
    bus.emit(EV.HP, { me: this.hpMe, opp: this.hpBot });
    let s = 3;
    bus.emit(EV.TICK, { msLeft: 0 });
    const cd = window.setInterval(() => {
      audio.sfx("countdown");
      s -= 1;
      if (s <= 0) { clearInterval(cd); this.nextRound(); }
    }, 700);
  }

  private nextRound() {
    this.idx += 1;
    if (this.ended) return;
    if (this.idx >= this.questions.length || this.hpMe <= 0 || this.hpBot <= 0) return this.gameOver();

    const q = this.questions[this.idx];
    this.submitted = false; this.timeUp = false; this.resolved = false;
    this.playerBlanks = null; this.playerMs = 0;
    this.roundStart = Date.now();
    this.roundLimitS = getRoundTimeLimitByBlankCount(q.blankCount);
    const limitMs = this.roundLimitS * 1000;

    bus.emit(EV.ROUND_START, {
      index: this.idx, total: this.questions.length,
      question: {
        id: q.id, questionEn: q.questionEn, questionZh: q.questionZh,
        chapter: q.chapter, years: q.years, difficulty: q.difficulty, blankCount: q.blankCount,
      },
      endsAtMs: this.roundStart + limitMs,
      roundTimeLimit: this.roundLimitS,
    });

    // tick — at 0 we announce TIME_UP but DO NOT auto-resolve / auto-advance.
    this.tickTimer = window.setInterval(() => {
      const left = this.roundStart + limitMs - Date.now();
      bus.emit(EV.TICK, { msLeft: Math.max(0, left) });
      if (left <= 0) {
        if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = undefined; }
        if (!this.timeUp && !this.resolved) {
          this.timeUp = true;
          audio.sfx("countdown");
          bus.emit(EV.TIME_UP, { index: this.idx });
        }
      }
    }, 150) as unknown as number;

    // bot plan (decided up front; only "lands" if its planned time elapses before resolution)
    const prof = BOT[this.settings.botDifficulty ?? "normal"];
    const botTimeS = prof.minS + Math.random() * (prof.maxS - prof.minS);
    this.botCorrect = Math.random() < prof.correctP && botTimeS <= this.roundLimitS;
    this.botAnswerMs = this.botCorrect ? botTimeS * 1000 : Infinity;
  }

  private onSubmit(blanks: string[]) {
    if (this.resolved || this.idx < 0 || this.ended) return;
    this.submitted = true;
    this.playerBlanks = blanks;
    this.playerMs = Date.now() - this.roundStart;
    this.resolve();
  }

  // Player pressed "Show answer" after time-up without submitting.
  private onReveal() {
    if (this.resolved || this.idx < 0 || this.ended) return;
    this.resolve();
  }

  // Player pressed "Next question".
  private onNext() {
    if (this.ended || !this.resolved) return;
    this.nextRound();
  }

  private resolve() {
    if (this.idx < 0 || this.ended || this.resolved) return;
    this.resolved = true;
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = undefined; }

    const q = this.questions[this.idx];
    const limitMs = this.roundLimitS * 1000;

    const meAnswered = this.playerBlanks !== null;
    const meInTime = meAnswered && !this.timeUp;       // answered before the clock ran out
    const mePractice = meAnswered && this.timeUp;       // answered after time-up (practice)
    const meCheck = meAnswered
      ? checkAnswer(this.playerBlanks!, q.acceptedAnswers, q.answers)
      : { isCorrect: false, correctBlanks: [] };
    const meCorrect = meCheck.isCorrect;
    const meMs = meAnswered ? this.playerMs : limitMs;

    // bot "answered" only if its planned time elapsed before this resolution moment
    const resolveElapsed = meInTime ? this.playerMs : limitMs;
    const botAnswered = this.botCorrect && this.botAnswerMs <= resolveElapsed;
    const botMs = botAnswered ? this.botAnswerMs : limitMs;

    // ---- stats (independent of combo) ----
    this.statMe.total++; this.statBot.total++;
    if (meCorrect) {
      this.statMe.correct++;
      if (meInTime) {
        this.statMe.avgMs += meMs;
        this.statMe.fastestMs = this.statMe.fastestMs === null ? meMs : Math.min(this.statMe.fastestMs, meMs);
      }
      audio.sfx("correct");
    } else {
      this.statMe.wrong.push({
        questionEn: q.questionEn, questionZh: q.questionZh,
        correctAnswers: q.answers, your: this.playerBlanks ?? [],
        explanationZh: q.explanationZh,
      });
      if (meAnswered) audio.sfx("wrong");
    }
    if (botAnswered) {
      this.statBot.correct++; this.statBot.avgMs += botMs;
      this.statBot.fastestMs = this.statBot.fastestMs === null ? botMs : Math.min(this.statBot.fastestMs, botMs);
    }

    // ---- combo winner (only ONE side may keep/extend combo per round) ----
    // A practice answer (after time-up) is NOT a valid in-time win, so it can
    // never extend combo — the player must win a round in time.
    const meValid = meInTime && meCorrect;          // me answered correctly, in time
    const prevComboMe = this.comboMe;
    const prevComboBot = this.comboBot;
    let winner: "me" | "opp" | "none";
    if (meValid && botAnswered) winner = meMs <= botMs ? "me" : "opp"; // both correct -> earlier wins
    else if (meValid) winner = "me";
    else if (botAnswered) winner = "opp";
    else winner = "none";

    if (winner === "me") { this.comboMe = prevComboMe + 1; this.comboBot = 0; }
    else if (winner === "opp") { this.comboBot = prevComboBot + 1; this.comboMe = 0; }
    else { this.comboMe = 0; this.comboBot = 0; }

    const meComboBroken = prevComboMe > 0 && this.comboMe === 0; // opponent (or slower) broke my streak

    // ---- damage (winner deals it EXACTLY ONCE; triple/grand are visual only) ----
    let dmgToBot = 0, dmgToMe = 0;
    let meAttackType: AttackType = "normal";
    let oppAttackType: AttackType = "normal";
    let meMultiplier = 1, meBaseDamage = 0;

    if (winner === "me") {
      const timeLeft = Math.max(0, this.roundLimitS - meMs / 1000);
      const detail = computeDamageDetailed({
        questionCount: this.settings.questionCount, timeLimit: this.roundLimitS,
        timeLeft, combo: this.comboMe, halved: botAnswered, // both correct -> earlier is halved
      });
      dmgToBot = detail.final; meAttackType = detail.pattern.attackType;
      meMultiplier = detail.multiplier; meBaseDamage = detail.base;
      this.statMe.totalDamage += dmgToBot;
    } else if (winner === "opp") {
      const timeLeft = Math.max(0, this.roundLimitS - botMs / 1000);
      const detail = computeDamageDetailed({
        questionCount: this.settings.questionCount, timeLimit: this.roundLimitS,
        timeLeft, combo: this.comboBot, halved: meValid,
      });
      dmgToMe = detail.final;
      oppAttackType = detail.pattern.attackType;
      this.statBot.totalDamage += dmgToMe;
    }

    // PRACTICE reward: a correct answer after time-up deals a flat 1 (no combo, no formula)
    if (mePractice && meCorrect) { dmgToBot += 1; this.statMe.totalDamage += 1; }

    // ---- apply + animate (staggered casts) ----
    const apply = () => {
      this.hpBot = Math.max(0, this.hpBot - dmgToBot);
      this.hpMe = Math.max(0, this.hpMe - dmgToMe);
      bus.emit(EV.HP, { me: this.hpMe, opp: this.hpBot });
    };
    if (dmgToBot > 0) { audio.sfx("cast"); bus.emit(EV.CAST, { who: "me", attackType: meAttackType }); window.setTimeout(() => { audio.sfx("hit"); bus.emit(EV.HIT, { who: "opp", damage: dmgToBot, attackType: meAttackType }); }, meAttackType === "triple" ? 720 : 430); }
    if (dmgToMe > 0) { window.setTimeout(() => { audio.sfx("cast"); bus.emit(EV.CAST, { who: "opp", attackType: oppAttackType }); }, 250); window.setTimeout(() => { audio.sfx("hit"); bus.emit(EV.HIT, { who: "me", damage: dmgToMe, attackType: oppAttackType }); }, oppAttackType === "triple" ? 980 : 680); }
    window.setTimeout(apply, 760);

    // ---- reveal to React (now carries explanation + practice flag; awaits NEXT) ----
    const mePattern = getComboPattern(this.comboMe);
    bus.emit(EV.ROUND_RESULT, {
      index: this.idx,
      correctAnswers: q.answers, acceptedAnswers: q.acceptedAnswers, answerNote: q.answerNote,
      questionEn: q.questionEn, questionZh: q.questionZh, years: q.years, chapter: q.chapter,
      explanationZh: q.explanationZh, explanationEn: q.explanationEn,
      practice: mePractice,
      awaitNext: true,            // bot mode: do not auto-advance
      comboBroken: meComboBroken,
      me: {
        correct: meCorrect, blanks: this.playerBlanks ?? [], ms: meAnswered ? meMs : null,
        damage: dmgToBot, combo: this.comboMe, practice: mePractice,
        attackType: winner === "me" ? meAttackType : "normal",
        attackLabel: winner === "me" ? mePattern.label : "",
        attackLabelZh: winner === "me" ? mePattern.labelZh : "",
        multiplier: winner === "me" ? meMultiplier : 1,
        baseDamage: meBaseDamage,
      },
      opp: { correct: botAnswered, ms: botAnswered ? botMs : null, damage: dmgToMe, attackType: oppAttackType },
    });
    // NOTE: no auto-advance here — player must press "Next" (EV.NEXT).
  }

  private gameOver() {
    if (this.ended) return;
    this.ended = true;
    this.offs.forEach((o) => o());
    for (const s of [this.statMe, this.statBot]) {
      s.accuracy = s.total ? s.correct / s.total : 0;
      s.avgMs = s.correct ? s.avgMs / s.correct : 0;
    }
    let meWon: boolean | null;
    if (this.hpMe <= 0 || this.hpBot <= 0) meWon = this.hpMe > 0 ? true : this.hpBot > 0 ? false : null;
    else if (this.hpMe !== this.hpBot) meWon = this.hpMe > this.hpBot;
    else meWon = this.statMe.correct === this.statBot.correct ? null : this.statMe.correct > this.statBot.correct;

    audio.sfx(meWon ? "victory" : "defeat");
    const summary: BattleSummary = { meWon, me: this.statMe, bot: this.statBot };
    bus.emit(EV.GAME_OVER, { meWon, summary });
  }

  dispose() {
    this.ended = true;
    this.offs.forEach((o) => o());
    if (this.tickTimer) clearInterval(this.tickTimer);
  }
}
