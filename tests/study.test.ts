import { describe, expect, it } from "vitest";
import { emptyState, parseStudyState, progress, storageKey, daysUntilExam, validCalendarDate } from "../src/hooks/studyStorage";
import { recommendTopics } from "../src/data/recommendations";
import { numericMatches, parseNumericAnswer } from "../src/data/numericAnswers";
import { canPractice, validateExamCatalog } from "../src/data/examCatalog";
import { questions } from "../src/data/questions";
import { topics, activities } from "../src/data/topics";
import type { Question } from "../src/types";

// Synthetic fixtures exercise the infrastructure; they are never published as course material.
const numeric: Question = { id: "test-number", examId: "test", topic: "test", prompt: "Fixture", options: [], correct: null, type: "numeric", verified: true, numericAnswer: { value: 1 / 3, absoluteTolerance: 0.001, relativeTolerance: 0.001 }, explanation: "", origin: "Parcial anterior", tags: [] };

describe("Materia independiente", () => {
  it("inicia con progreso independiente y datos con identificadores únicos", () => {
    expect(storageKey).toBe("probabilidad-estadistica-estudio-v1");
    for (const items of [questions, topics, activities])
      expect(new Set(items.map(item => item.id)).size).toBe(items.length);
    expect(progress(emptyState)).toBe(0);
    expect(recommendTopics(emptyState)).toEqual([]);
  });
  it("recupera datos dañados y descarta actividades ajenas", () => {
    for (const value of [null, "null", "[", "{}"])
      expect(parseStudyState(value)).toEqual(emptyState);
    expect(parseStudyState(JSON.stringify({ completed: { otraMateria: "2026-11-15" }, examDate: "2026-02-30" }))).toEqual(emptyState);
  });
  it("conserva intentos sin calificar y fechas válidas", () => {
    const state = parseStudyState(JSON.stringify({ examDate: "2026-11-25", attempts: [{ id: "test", date: "2026-11-15", mode: "parcial", answers: [], pendingAnswers: [{ questionId: "fixture", response: "Mi desarrollo" }] }] }));
    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0].answers).toEqual([]);
    expect(daysUntilExam(state.examDate, new Date(2026, 10, 15, 23, 59))).toBe(10);
    expect(validCalendarDate("2028-02-29")).toBe(true);
    expect(validCalendarDate("2026-02-29")).toBe(false);
  });
});

describe("Resultados matemáticos", () => {
  it("acepta coma, punto y notación científica sin interpretar expresiones", () => {
    expect(parseNumericAnswer(" 0,333 ")).toBe(0.333);
    expect(parseNumericAnswer("-1.2e-3")).toBe(-0.0012);
    for (const text of ["", " ", "Infinity", "NaN", "1/3", "0x10", "1,2,3", "1.2abc", "1e999"])
      expect(parseNumericAnswer(text)).toBeNull();
  });
  it("aplica tolerancias absolutas y relativas, también cerca de cero", () => {
    expect(numericMatches("0,333", numeric.numericAnswer)).toBe(true);
    expect(numericMatches("0.4", numeric.numericAnswer)).toBe(false);
    expect(numericMatches("100.9", { value: 100, absoluteTolerance: 0.01, relativeTolerance: 0.01 })).toBe(true);
    expect(numericMatches("0.0001", { value: 0, absoluteTolerance: 0.001, relativeTolerance: 0.001 })).toBe(true);
    expect(numericMatches("", numeric.numericAnswer)).toBe(false);
  });
  it("no califica resultados sin verificar ni tolerancias inválidas", () => {
    expect(canPractice(numeric)).toBe(true);
    expect(canPractice({ ...numeric, verified: false })).toBe(false);
    for (const tolerance of [-1, NaN, Infinity])
      expect(canPractice({ ...numeric, numericAnswer: { value: 0, absoluteTolerance: tolerance, relativeTolerance: 0 } })).toBe(false);
    expect(canPractice({ ...numeric, numericAnswer: { value: 0, absoluteTolerance: 0, relativeTolerance: 0 } })).toBe(false);
  });
  it("valida catálogos y rechaza respuestas numéricas sin tolerancia", () => {
    const catalog = { version: 1, exams: [{ id: "test", title: "Fixture", topic: "test", photos: [] }], questions: [numeric] };
    expect(() => validateExamCatalog(catalog)).not.toThrow();
    expect(() => validateExamCatalog({ ...catalog, questions: [{ ...numeric, numericAnswer: { value: 0 } }] })).toThrow();
    expect(() => validateExamCatalog({ ...catalog, questions: [{ ...numeric, photoId: "ausente" }] })).toThrow();
    expect(() => validateExamCatalog({ version: 1, exams: [], questions: [numeric] })).toThrow();
  });
  it("recomienda el error más reciente y lo retira al acertar", () => {
    const state = { ...emptyState, attempts: [{ id: "a", date: "2026-11-15", mode: "repaso" as const, answers: [{ questionId: numeric.id, correct: false }] }] };
    const list = [{ id: "test", title: "Fixture" }];
    expect(recommendTopics(state, [numeric], list)[0].errors).toBe(1);
    state.attempts.push({ id: "b", date: "2026-11-15", mode: "repaso", answers: [{ questionId: numeric.id, correct: true }] });
    expect(recommendTopics(state, [numeric], list)).toEqual([]);
  });
});
