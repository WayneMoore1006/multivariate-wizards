// ============================================================================
// shared/gameLogic.ts
// Damage formula — identical on server (authoritative) and client (1vBot).
// ============================================================================
export interface DamageParams {
  questionCount: number;
  timeLimit: number;   // seconds
  timeLeft: number;    // seconds remaining when correct
  combo: number;       // combo streak after this correct answer
  halved: boolean;     // answered later than opponent (both correct)
}

// ----------------------------------------------------------------------------
// Per-question countdown length, scaled by how many blanks must be filled.
//   1–2 blanks -> 30s   ·   3 blanks -> 45s   ·   4+ blanks -> 60s
// Used by BOTH 1vBot (client) and 1v1 Online (server authoritative) so the
// timer, timeout judging and damage speed all agree.
// ----------------------------------------------------------------------------
export function getRoundTimeLimitByBlankCount(blankCount: number): number {
  if (blankCount >= 4) return 60;
  if (blankCount === 3) return 45;
  return 30;
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

// ----------------------------------------------------------------------------
// Combo pattern — a 5-combo repeating cycle. SHARED by 1vBot (client) and
// 1v1 Online (server) so the rule can never diverge.
//   step = ((combo - 1) % 5) + 1
//     step 3  -> triple cast (visual: 3 projectiles, ONE damage) x1.15
//     step 5  -> grand spell (visual: 1 huge projectile, ONE damage) x1.25
//     else    -> normal cast x1.0
//   => triple at combo 3,8,13,18…  grand at 5,10,15,20…  (4,6,7,9 are normal)
// ----------------------------------------------------------------------------
export type AttackType = "normal" | "triple" | "grand";

export interface ComboPattern {
  attackType: AttackType;
  multiplier: number;
  label: string;
  labelZh: string;
}

export function getComboPattern(combo: number): ComboPattern {
  const step = combo <= 0 ? 0 : ((combo - 1) % 5) + 1;
  if (step === 3) return { attackType: "triple", multiplier: 1.15, label: "Triple Cast!", labelZh: "三連詠唱！" };
  if (step === 5) return { attackType: "grand", multiplier: 1.25, label: "Grand Spell!", labelZh: "大型咒術！" };
  return { attackType: "normal", multiplier: 1.0, label: "Normal Cast", labelZh: "普通攻擊" };
}

export interface DamageResult {
  base: number;        // speed-formula damage of a NORMAL hit (no combo)
  multiplier: number;  // combo multiplier (1.0 / 1.15 / 1.25)
  final: number;       // actual HP removed — applied EXACTLY ONCE per round
  pattern: ComboPattern;
}

/**
 * Detailed damage. The combo multiplier is applied AFTER the normal-attack clamp,
 * then bounded by maxDamage*1.25 so Triple/Grand stay visible but balanced
 * (combo may modestly break the normal cap; comment kept intentionally).
 */
export function computeDamageDetailed(p: DamageParams): DamageResult {
  const base = 100 / Math.max(1, p.questionCount);
  const speedMult = 0.7 + 0.9 * (clamp(p.timeLeft, 0, p.timeLimit) / p.timeLimit);
  let raw = base * speedMult;
  if (p.halved) raw *= 0.5;

  const minDamage = Math.max(3, Math.round(base * 0.5));
  const maxDamage = Math.max(8, Math.round(base * 1.8));
  const baseDamage = clamp(Math.round(raw), minDamage, maxDamage); // a normal hit

  const pattern = getComboPattern(p.combo);
  const final = clamp(Math.round(baseDamage * pattern.multiplier), minDamage, Math.round(maxDamage * 1.25));
  return { base: baseDamage, multiplier: pattern.multiplier, final, pattern };
}

export function computeDamage(p: DamageParams): number {
  return computeDamageDetailed(p).final;
}
