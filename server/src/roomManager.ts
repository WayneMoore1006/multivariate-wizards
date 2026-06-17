// ============================================================================
// server/src/roomManager.ts
// In-memory room registry for 1v1 online play.
// ============================================================================
import type { GameSettings, PlayerState, RoomState, WizardKind, Question } from "../../shared/types";

export interface ServerRoom {
  code: string;
  settings: GameSettings;
  players: PlayerState[];
  phase: RoomState["phase"];
  questions: Question[];
  questionIndex: number;
  // per-round transient data
  roundStartMs: number;
  roundEndMs: number;
  roundId: string;            // unique id for the current round
  roundTimeLimit: number;     // seconds for the current round (from blankCount)
  submissions: Record<string, { blanks: string[]; atMs: number; correct: boolean }>;
  timer?: NodeJS.Timeout;
  // accumulated per-player stats
  stats: Record<string, { correct: number; total: number; sumMs: number; fastest: number | null; dmg: number; wrong: { questionEn: string; correctAnswers: string[]; your: string[] }[] }>;
}

const rooms = new Map<string, ServerRoom>();

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  do {
    c = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(c));
  return c;
}

export function createRoom(host: { id: string; nickname: string; wizard: WizardKind }, settings: GameSettings): ServerRoom {
  const code = genCode();
  const room: ServerRoom = {
    code, settings, phase: "lobby",
    players: [mkPlayer(host)],
    questions: [], questionIndex: -1,
    roundStartMs: 0, roundEndMs: 0, roundId: "", roundTimeLimit: 30, submissions: {}, stats: {},
  };
  rooms.set(code, room);
  return room;
}

function mkPlayer(p: { id: string; nickname: string; wizard: WizardKind; isBot?: boolean }): PlayerState {
  return {
    id: p.id, nickname: p.nickname || "Wizard", wizard: p.wizard,
    hp: 100, maxHp: 100, ready: false, connected: true, combo: 0, isBot: p.isBot,
  };
}

export function joinRoom(code: string, p: { id: string; nickname: string; wizard: WizardKind }): { ok: boolean; error?: string; room?: ServerRoom } {
  const room = rooms.get(code);
  if (!room) return { ok: false, error: "Room not found" };
  if (room.players.length >= 2) return { ok: false, error: "Room is full" };
  if (room.phase !== "lobby") return { ok: false, error: "Game already started" };
  room.players.push(mkPlayer(p));
  return { ok: true, room };
}

export function getRoom(code: string): ServerRoom | undefined { return rooms.get(code); }
export function removeRoom(code: string) { const r = rooms.get(code); if (r?.timer) clearTimeout(r.timer); rooms.delete(code); }
export function findRoomBySocket(id: string): ServerRoom | undefined {
  for (const r of rooms.values()) if (r.players.some((p) => p.id === id)) return r;
  return undefined;
}

export function toRoomState(r: ServerRoom): RoomState {
  return {
    code: r.code, phase: r.phase, settings: r.settings,
    players: r.players, questionIndex: r.questionIndex, totalQuestions: r.settings.questionCount,
  };
}

export function resetStats(r: ServerRoom) {
  r.stats = {};
  for (const p of r.players) r.stats[p.id] = { correct: 0, total: 0, sumMs: 0, fastest: null, dmg: 0, wrong: [] };
}
