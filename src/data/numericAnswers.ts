import type { Question } from "../types";

export function parseNumericAnswer(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function validNumericAnswer(value: unknown): value is NonNullable<Question["numericAnswer"]> {
  if (!value || typeof value !== "object") return false;
  const a = value as Record<string, unknown>;
  return typeof a.value === "number" && Number.isFinite(a.value) &&
    typeof a.absoluteTolerance === "number" && Number.isFinite(a.absoluteTolerance) && a.absoluteTolerance >= 0 &&
    typeof a.relativeTolerance === "number" && Number.isFinite(a.relativeTolerance) && a.relativeTolerance >= 0 &&
    (a.absoluteTolerance > 0 || a.relativeTolerance > 0);
}

export function numericMatches(input: string, answer: Question["numericAnswer"]): boolean {
  if (!validNumericAnswer(answer)) return false;
  const value = parseNumericAnswer(input);
  return value !== null && Math.abs(value - answer.value) <= Math.max(answer.absoluteTolerance, answer.relativeTolerance * Math.abs(answer.value));
}
