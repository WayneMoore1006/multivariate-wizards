// ============================================================================
// server/src/answerValidator.ts
// Authoritative answer checking. Damage formula lives in shared/gameLogic.ts.
// ============================================================================
import { checkAnswer } from "../../shared/answerUtils";
import { computeDamage, type DamageParams } from "../../shared/gameLogic";
import type { Question } from "../../shared/types";

export function validate(q: Question, blanks: string[]) {
  return checkAnswer(blanks, q.acceptedAnswers, q.answers);
}

export { computeDamage };
export type { DamageParams };
