// Minimal typed event emitter — bridges the Phaser BattleScene and React UI,
// and is also emitted to by LocalBattle (bot) and OnlineBattle (socket).
type Handler = (payload: any) => void;

class EventBus {
  private map = new Map<string, Set<Handler>>();
  on(evt: string, fn: Handler) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt)!.add(fn);
    return () => this.off(evt, fn);
  }
  off(evt: string, fn: Handler) { this.map.get(evt)?.delete(fn); }
  emit(evt: string, payload?: any) { this.map.get(evt)?.forEach((fn) => fn(payload)); }
  clear() { this.map.clear(); }
}

export const bus = new EventBus();

// Event names shared across the app
export const EV = {
  ROUND_START: "round:start",     // { index, question, total, endsAtMs }
  ROUND_RESULT: "round:result",   // RoundResultPayload-like
  HP: "hp",                       // { [playerId]: hp }
  CAST: "fx:cast",                // { who: 'me'|'opp', wizard }
  HIT: "fx:hit",                  // { who: 'me'|'opp', damage }
  GAME_OVER: "game:over",         // summary
  TICK: "round:tick",             // { msLeft }
  SUBMIT: "answer:submit",        // { blanks }
  TIME_UP: "round:timeup",        // bot mode: timer hit 0, no auto-advance { index }
  REVEAL: "round:reveal",         // bot mode: player asked to show answer (no submit)
  NEXT: "round:next",             // bot mode: player pressed "Next question"
} as const;
