// client/src/net/socket.ts
import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents, ServerToClientEvents, GameSettings, WizardKind,
  RoomState, RoundResultPayload, GameOverPayload,
} from "@shared/types";
import { bus, EV } from "../game/EventBus";
import { getComboPattern } from "@shared/gameLogic";

const URL = import.meta.env.PROD 
  ? window.location.origin 
  : ((import.meta as any).env?.VITE_SERVER_URL || "http://localhost:3001");

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: ClientSocket | null = null;
export function getSocket(): ClientSocket {
  if (!socket) socket = io(URL, { transports: ["websocket", "polling"] });
  return socket;
}

// Bridges server round/result events into the same EventBus the scene listens to.
export function bridgeOnline(myId: () => string, onRoom: (r: RoomState) => void, onGameOver: (g: GameOverPayload) => void) {
  const s = getSocket();
  const offs: (() => void)[] = [];

  const onRoomUpdate = (r: RoomState) => onRoom(r);
  const onCountdown = (_p: { seconds: number }) => bus.emit(EV.TICK, { msLeft: 0 });

  // ---- SINGLE timer source, gated by roundId (fixes next-question flicker) ----
  let tickHandle: number | undefined;
  let currentRoundId = "";
  const stopTick = () => { if (tickHandle !== undefined) { clearInterval(tickHandle); tickHandle = undefined; } };

  const onQuestion = (p: any) => {
    stopTick(); // kill the previous round's interval before starting a new one
    currentRoundId = p.round.roundId ?? `${p.round.index}`;
    const myRoundId = currentRoundId;
    const endsAtMs = p.round.endsAtMs;

    bus.emit(EV.ROUND_START, {
      index: p.round.index, total: p.room.totalQuestions,
      question: p.round.question, endsAtMs,
      roundTimeLimit: p.round.roundTimeLimit ?? 30,
      roundId: myRoundId,
    });
    bus.emit(EV.TICK, { msLeft: Math.max(0, endsAtMs - Date.now()) });

    tickHandle = window.setInterval(() => {
      // a stale interval (different round) must never update the UI
      if (myRoundId !== currentRoundId) { clearInterval(tickHandle); return; }
      const left = endsAtMs - Date.now();
      bus.emit(EV.TICK, { msLeft: Math.max(0, left) });
      if (left <= 0) stopTick();
    }, 200) as unknown as number;
  };
  const onRoundResult = (p: RoundResultPayload) => {
    stopTick(); // round is over — freeze the timer, no more ticking on the result view
    const me = myId();
    const opp = Object.keys(p.results).find((id) => id !== me) ?? "";
    const meRes = p.results[me]; const oppRes = p.results[opp];
    const dmgMe = p.damageDealt[me] ?? 0; const dmgOpp = p.damageDealt[opp] ?? 0;
    const meAtk = p.attackTypes?.[me] ?? "normal"; const oppAtk = p.attackTypes?.[opp] ?? "normal";
    if (dmgMe > 0) { bus.emit(EV.CAST, { who: "me", attackType: meAtk }); setTimeout(() => bus.emit(EV.HIT, { who: "opp", damage: dmgMe, attackType: meAtk }), meAtk === "triple" ? 720 : 430); }
    if (dmgOpp > 0) { setTimeout(() => bus.emit(EV.CAST, { who: "opp", attackType: oppAtk }), 250); setTimeout(() => bus.emit(EV.HIT, { who: "me", damage: dmgOpp, attackType: oppAtk }), oppAtk === "triple" ? 980 : 680); }
    setTimeout(() => bus.emit(EV.HP, { me: p.hp[me] ?? 0, opp: p.hp[opp] ?? 0 }), 760);
    const meCombo = p.combos[me] ?? 0;
    const mePattern = getComboPattern(meCombo);
    bus.emit(EV.ROUND_RESULT, {
      index: p.index, correctAnswers: p.correctAnswers, acceptedAnswers: p.acceptedAnswers,
      questionEn: p.questionEn, questionZh: p.questionZh, years: p.sourceYears,
      comboBroken: p.comboBroken?.[me] ?? false,
      me: {
        correct: meRes?.isCorrect ?? false, blanks: meRes?.submittedAnswers ?? [], ms: meRes?.answeredAtMs ?? null,
        damage: dmgMe, combo: meCombo,
        attackType: dmgMe > 0 ? meAtk : "normal",
        attackLabel: dmgMe > 0 ? mePattern.label : "", attackLabelZh: dmgMe > 0 ? mePattern.labelZh : "",
        multiplier: dmgMe > 0 ? mePattern.multiplier : 1,
      },
      opp: { correct: oppRes?.isCorrect ?? false, ms: oppRes?.answeredAtMs ?? null, damage: dmgOpp, attackType: oppAtk },
    });
  };
  const onOver = (g: GameOverPayload) => {
    const me = myId();
    const meWon = g.winnerId === null ? null : g.winnerId === me;
    bus.emit(EV.GAME_OVER, { meWon, summary: null });
    onGameOver(g);
  };
  const onDisc = () => bus.emit("opponent:disconnected");

  s.on("roomUpdate", onRoomUpdate);
  s.on("countdown", onCountdown);
  s.on("question", onQuestion);
  s.on("roundResult", onRoundResult);
  s.on("gameOver", onOver);
  s.on("opponentDisconnected", onDisc);

  offs.push(() => { stopTick(); s.off("roomUpdate", onRoomUpdate); s.off("countdown", onCountdown); s.off("question", onQuestion); s.off("roundResult", onRoundResult); s.off("gameOver", onOver); s.off("opponentDisconnected", onDisc); });

  // forward player submissions to the server
  offs.push(bus.on(EV.SUBMIT, (d: { blanks: string[]; roomCode: string; questionId: string }) => {
    s.emit("submitAnswer", { roomCode: d.roomCode, questionId: d.questionId, blanks: d.blanks, answeredAtMs: Date.now() });
  }));

  return () => offs.forEach((o) => o());
}

export const helpers = {
  createRoom: (nickname: string, wizard: WizardKind, settings: GameSettings) =>
    new Promise<string>((res) => getSocket().emit("createRoom", { nickname, wizard, settings }, (r) => res(r.code))),
  joinRoom: (code: string, nickname: string, wizard: WizardKind) =>
    new Promise<{ ok: boolean; error?: string; room?: RoomState }>((res) =>
      getSocket().emit("joinRoom", { code, nickname, wizard }, (r) => res(r))),
  ready: (code: string, ready: boolean, wizard?: WizardKind) => getSocket().emit("playerReady", { code, ready, wizard }),
  updateWizard: (code: string, wizard: WizardKind) => getSocket().emit("updateWizard", { code, wizard }),
  start: (code: string) => getSocket().emit("startGame", { code }),
  leave: (code: string) => getSocket().emit("leaveRoom", { code }),
};
