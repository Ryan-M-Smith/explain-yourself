import type { EvaluationEvent } from "./types";

export const EVENT_SCORE_DELTAS = {
  NEW_RELEVANT_CLAIM: 0.02,
  VALID_EVIDENCE: 0.08,
  CONCERN_SATISFIED: 0.1,
  MINOR_CONTRADICTION: -0.04,
  MAJOR_CONTRADICTION: -0.1,
  POLICY_VIOLATION: -0.2,
} satisfies Record<EvaluationEvent, number>;

export function calculateScoreDelta(
  events: EvaluationEvent[],
): number {
  return events.reduce(
    (total, event) => total + EVENT_SCORE_DELTAS[event],
    0,
  );
}

export function clampApprovalScore(score: number): number {
  return Math.min(1, Math.max(0, score));
}