// ============================================================================
// server/src/socket.ts
// Wires Socket.IO events to the authoritative game loop.
// ============================================================================
import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents, ServerToClientEvents, SubmitAnswerPayload,
  RoundResultPayload, GameOverPayload, AnswerCheck, PlayerSummary,
} from "../../shared/types";
import {
  createRoom, joinRoom, getRoom, removeRoom, findRoomBySocket,
  toRoomState, resetStats, type ServerRoom,
} from "./roomManager";
import { pickQuestions, toPublic } from "./questionService";
import { validate } from "./answerValidator";
import { computeDamageDetailed, getRoundTimeLimitByBlankCount } from "../../shared/gameLogic";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type Sock = Socket<ClientToServerEvents, ServerToClientEvents>;

function broadcastRoom(io: IO, r: ServerRoom) {
  io.to(r.code).emit("roomUpdate", toRoomState(r));
}

function startGame(io: IO, r: ServerRoom) {
  if (r.players.length < 2) return;
  r.questions = pickQuestions(r.settings.questionCount);
  r.settings.questionCount = r.questions.length; // in case bank smaller than requested
  r.questionIndex = -1;
  for (const p of r.players) { p.hp = p.maxHp; p.combo = 0; }
  resetStats(r);
  r.phase = "countdown";
  broadcastRoom(io, r);

  let s = 3;
  io.to(r.code).emit("countdown", { seconds: s });
  const cd = setInterval(() => {
    s -= 1;
    if (s > 0) io.to(r.code).emit("countdown", { seconds: s });
    else { clearInterval(cd); nextQuestion(io, r); }
  }, 1000);
}

function nextQuestion(io: IO, r: ServerRoom) {
  r.questionIndex += 1;
  if (r.questionIndex >= r.questions.length || r.players.some((p) => p.hp <= 0)) {
    return endGame(io, r);
  }
  const q = r.questions[r.questionIndex];
  r.submissions = {};
  r.phase = "question";
  const now = Date.now();
  const roundTimeLimit = getRoundTimeLimitByBlankCount(q.blankCount);
  r.roundTimeLimit = roundTimeLimit;
  r.roundStartMs = now;
  r.roundEndMs = now + roundTimeLimit * 1000;
  r.roundId = `${r.code}-${r.questionIndex}-${now}`;

  io.to(r.code).emit("question", {
    round: {
      index: r.questionIndex, question: toPublic(q), startedAtMs: now, endsAtMs: r.roundEndMs,
      roundId: r.roundId, roundTimeLimit,
    },
    room: toRoomState(r),
  });

  if (r.timer) clearTimeout(r.timer);
  r.timer = setTimeout(() => resolveRound(io, r), roundTimeLimit * 1000 + 250);
}

function resolveRound(io: IO, r: ServerRoom) {
  if (r.phase !== "question") return;
  r.phase = "reveal";
  if (r.timer) clearTimeout(r.timer);

  const q = r.questions[r.questionIndex];
  const results: Record<string, AnswerCheck> = {};
  const damageDealt: Record<string, number> = {};
  const combos: Record<string, number> = {};

  // build per-player check + answer time (combo handled AFTER, by round winner)
  const correctTimes: { id: string; atMs: number }[] = [];
  for (const p of r.players) {
    const sub = r.submissions[p.id];
    const blanks = sub?.blanks ?? [];
    const check = sub ? validate(q, blanks) : { isCorrect: false, correctBlanks: q.acceptedAnswers.map(() => false) };
    const answeredAtMs = sub ? sub.atMs - r.roundStartMs : r.roundTimeLimit * 1000;
    results[p.id] = {
      isCorrect: check.isCorrect,
      correctBlanks: check.correctBlanks,
      submittedAnswers: blanks,
      correctAnswers: q.answers,
      answeredAtMs,
    };
    damageDealt[p.id] = 0;

    const st = r.stats[p.id];
    st.total += 1;
    if (check.isCorrect) {
      st.correct += 1;
      st.sumMs += answeredAtMs;
      st.fastest = st.fastest === null ? answeredAtMs : Math.min(st.fastest, answeredAtMs);
      correctTimes.push({ id: p.id, atMs: answeredAtMs });
    } else {
      st.wrong.push({ questionEn: q.questionEn, correctAnswers: q.answers, your: blanks });
    }
  }

  // ---- combo winner: only ONE player may keep/extend combo per round ----
  //   both correct  -> earlier wins; the slower one's combo breaks
  //   one correct   -> that player wins
  //   none correct  -> both combos break
  const attackTypes: Record<string, "normal" | "triple" | "grand"> = {};
  const comboBroken: Record<string, boolean> = {};
  const prevCombo: Record<string, number> = {};
  for (const p of r.players) prevCombo[p.id] = p.combo;

  correctTimes.sort((a, b) => a.atMs - b.atMs);
  const winnerId = correctTimes.length ? correctTimes[0].id : null;

  for (const p of r.players) {
    if (p.id === winnerId) p.combo = prevCombo[p.id] + 1;
    else p.combo = 0;
    combos[p.id] = p.combo;
    comboBroken[p.id] = prevCombo[p.id] > 0 && p.combo === 0;
  }

  // ---- damage: winner deals it EXACTLY ONCE (triple/grand are visual only) ----
  if (winnerId) {
    const winner = r.players.find((p) => p.id === winnerId)!;
    const opp = r.players.find((p) => p.id !== winnerId);
    if (opp) {
      const bothCorrect = results[opp.id].isCorrect;       // opponent also correct (but slower) -> halved
      const winnerTime = results[winnerId].answeredAtMs;
      const timeLeft = Math.max(0, r.roundTimeLimit - winnerTime / 1000);
      const detail = computeDamageDetailed({
        questionCount: r.settings.questionCount,
        timeLimit: r.roundTimeLimit,
        timeLeft, combo: winner.combo, halved: bothCorrect,
      });
      opp.hp = Math.max(0, opp.hp - detail.final);
      damageDealt[winnerId] += detail.final;
      r.stats[winnerId].dmg += detail.final;
      attackTypes[winnerId] = detail.pattern.attackType;
    }
  }

  const hp: Record<string, number> = {};
  for (const p of r.players) hp[p.id] = p.hp;

  const payload: RoundResultPayload = {
    index: r.questionIndex,
    correctAnswers: q.answers,
    acceptedAnswers: q.acceptedAnswers,
    results, damageDealt, hp, combos, attackTypes, comboBroken,
    sourceYears: q.years,
    questionEn: q.questionEn, questionZh: q.questionZh,
  };
  io.to(r.code).emit("roundResult", payload);
  broadcastRoom(io, r);

  setTimeout(() => nextQuestion(io, r), 3500);
}

function endGame(io: IO, r: ServerRoom) {
  r.phase = "gameover";
  if (r.timer) clearTimeout(r.timer);
  const alive = r.players.filter((p) => p.hp > 0);
  let winnerId: string | null = null;
  if (r.players.some((p) => p.hp <= 0)) {
    winnerId = alive.length === 1 ? alive[0].id : null;
  } else {
    // all survived: higher HP wins, tie on correct count
    const [a, b] = r.players;
    if (a.hp !== b.hp) winnerId = a.hp > b.hp ? a.id : b.id;
    else {
      const ca = r.stats[a.id].correct, cb = r.stats[b.id].correct;
      winnerId = ca === cb ? null : ca > cb ? a.id : b.id;
    }
  }

  const perPlayerStats: Record<string, PlayerSummary> = {};
  for (const p of r.players) {
    const s = r.stats[p.id];
    perPlayerStats[p.id] = {
      correct: s.correct, total: s.total,
      accuracy: s.total ? s.correct / s.total : 0,
      avgAnswerMs: s.correct ? s.sumMs / s.correct : 0,
      fastestMs: s.fastest, totalDamage: s.dmg, wrongQuestions: s.wrong,
    };
  }

  const payload: GameOverPayload = { winnerId, players: r.players, perPlayerStats };
  io.to(r.code).emit("gameOver", payload);
  broadcastRoom(io, r);
}

export function registerSocketHandlers(io: IO) {
  io.on("connection", (socket: Sock) => {
    socket.on("createRoom", (p, cb) => {
      const room = createRoom({ id: socket.id, nickname: p.nickname, wizard: p.wizard }, p.settings);
      socket.join(room.code);
      cb({ code: room.code });
      broadcastRoom(io, room);
    });

    socket.on("joinRoom", (p, cb) => {
      const res = joinRoom(p.code.toUpperCase(), { id: socket.id, nickname: p.nickname, wizard: p.wizard });
      if (!res.ok || !res.room) { cb({ ok: false, error: res.error }); return; }
      socket.join(res.room.code);
      cb({ ok: true, room: toRoomState(res.room) });
      broadcastRoom(io, res.room);
    });

    socket.on("updateWizard", (p) => {
      const r = getRoom(p.code.toUpperCase());
      if (!r) return;
      const player = r.players.find((pl) => pl.id === socket.id);
      if (player && r.phase === "lobby") { player.wizard = p.wizard; broadcastRoom(io, r); }
    });

    socket.on("playerReady", (p) => {
      const r = getRoom(p.code.toUpperCase());
      if (!r) return;
      const player = r.players.find((pl) => pl.id === socket.id);
      if (player) {
        player.ready = p.ready;
        if (p.wizard) player.wizard = p.wizard; // lock in latest pick on ready
      }
      broadcastRoom(io, r);
      if (r.players.length === 2 && r.players.every((pl) => pl.ready) && r.phase === "lobby") {
        startGame(io, r);
      }
    });

    socket.on("startGame", (p) => {
      const r = getRoom(p.code.toUpperCase());
      if (r && r.phase === "lobby" && r.players.length === 2) startGame(io, r);
    });

    socket.on("submitAnswer", (p: SubmitAnswerPayload) => {
      const r = getRoom(p.roomCode.toUpperCase());
      if (!r || r.phase !== "question") return;
      const q = r.questions[r.questionIndex];
      if (!q || q.id !== p.questionId) return;
      if (r.submissions[socket.id]) return; // one submission per round
      r.submissions[socket.id] = { blanks: p.blanks, atMs: Date.now(), correct: false };
      // if both submitted, resolve early
      if (r.players.every((pl) => r.submissions[pl.id])) {
        setTimeout(() => resolveRound(io, r), 150);
      }
    });

    socket.on("leaveRoom", (p) => {
      const r = getRoom(p.code.toUpperCase());
      if (r) { socket.leave(r.code); handleLeave(io, r, socket.id); }
    });

    socket.on("disconnect", () => {
      const r = findRoomBySocket(socket.id);
      if (r) handleLeave(io, r, socket.id);
    });
  });
}

function handleLeave(io: IO, r: ServerRoom, id: string) {
  const player = r.players.find((p) => p.id === id);
  if (player) player.connected = false;
  io.to(r.code).emit("opponentDisconnected");
  if (r.phase !== "gameover") { if (r.timer) clearTimeout(r.timer); }
  // clean up empty rooms
  if (r.players.every((p) => !p.connected)) removeRoom(r.code);
  else broadcastRoom(io, r);
}
