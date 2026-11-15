import { validNumericAnswer } from "./numericAnswers.ts";
import type { Question } from "../types";

export interface ExamPhoto { id: string; src: string; alt: string }
export interface ExamPaper { id: string; title: string; date?: string; topic: string; photos: ExamPhoto[]; kind?: "exam" | "collection"; materialPending?: boolean }
export interface ExamCatalog { version: 1; exams: ExamPaper[]; questions: Question[] }
export const emptyExamCatalog: ExamCatalog = { version: 1, exams: [], questions: [] };
export const questionTypeLabels = { written: "Desarrollo", choice: "Opción múltiple", "true-false": "Verdadero o falso", selection: "Selección de respuesta", numeric: "Resultado numérico" };

export function canAttemptQuestion(question: Question): boolean {
  return question.type === "numeric" || question.type === "written" || question.options.length >= 2;
}

export function canPractice(question: Question): boolean {
  if (question.verified === false) return false;
  if (question.type === "numeric") return question.verified === true && validNumericAnswer(question.numericAnswer);
  if (question.type === "written") return question.verified === true && !!question.modelAnswer?.trim();
  return question.options.length >= 2 && Number.isInteger(question.correct) && question.correct !== null && question.correct >= 0 && question.correct < question.options.length;
}

export function questionAnswer(question: Question): string {
  if (!canPractice(question)) return "";
  if (question.type === "numeric") return String(question.numericAnswer?.value ?? "");
  return question.type === "written" ? question.modelAnswer ?? "" : question.correct === null ? "" : question.options[question.correct] ?? "";
}

export function validateExamCatalog(value: unknown): asserts value is ExamCatalog {
  const invalid = () => { throw new Error("El catálogo de parciales es inválido"); };
  const record = (v: unknown): Record<string, unknown> => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return invalid();
    return v as Record<string, unknown>;
  };
  const text = (v: unknown) => { if (typeof v !== "string" || !v.trim()) invalid(); };
  const catalog = record(value);
  if (catalog.version !== 1 || !Array.isArray(catalog.exams) || !Array.isArray(catalog.questions)) return invalid();
  const papers = new Map<string, Set<string>>();
  const collections = new Set<string>(), pendingMaterials = new Set<string>();
  for (const item of catalog.exams) {
    const paper = record(item); text(paper.id); text(paper.title); text(paper.topic);
    if (papers.has(paper.id as string) || !Array.isArray(paper.photos)) return invalid();
    if (paper.kind !== undefined && paper.kind !== "exam" && paper.kind !== "collection") invalid();
    if (paper.materialPending !== undefined && typeof paper.materialPending !== "boolean") invalid();
    if (paper.kind === "collection") collections.add(paper.id as string);
    if (paper.materialPending === true) {
      if (paper.photos.length) invalid();
      pendingMaterials.add(paper.id as string);
    }
    if (paper.date !== undefined && (typeof paper.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(paper.date) || !Number.isFinite(Date.parse(`${paper.date}T12:00:00`)) || new Date(`${paper.date}T12:00:00`).toLocaleDateString("sv-SE") !== paper.date)) invalid();
    const photos = new Set<string>();
    for (const item of paper.photos) {
      const photo = record(item); text(photo.id); text(photo.alt);
      if (typeof photo.src !== "string" || !/^exams\/images\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.(png|jpe?g|webp)$/i.test(photo.src) || photos.has(photo.id as string)) invalid();
      photos.add(photo.id as string);
    }
    papers.set(paper.id as string, photos);
  }
  const ids = new Set<string>();
  const numbers = new Set<string>();
  for (const item of catalog.questions) {
    const q = record(item); text(q.id); text(q.examId); text(q.topic); text(q.prompt);
    const origin = collections.has(q.examId as string) ? "Pregunta adicional recopilada para estudiar" : "Parcial anterior";
    if (ids.has(q.id as string) || !papers.has(q.examId as string) || pendingMaterials.has(q.examId as string) || q.origin !== origin || typeof q.verified !== "boolean" || !["choice", "written", "true-false", "selection", "numeric"].includes(q.type as string)) invalid();
    if (q.number !== undefined) {
      const key = `${q.examId}:${q.number}`;
      if (!Number.isSafeInteger(q.number) || (q.number as number) < 1 || numbers.has(key)) invalid();
      numbers.add(key);
    }
    if (q.reviewNote !== undefined && typeof q.reviewNote !== "string") invalid();
    ids.add(q.id as string);
    if (!Array.isArray(q.options) || !q.options.every(option => typeof option === "string" && option.trim()) || !Array.isArray(q.tags) || !q.tags.every(tag => typeof tag === "string") || typeof q.explanation !== "string") invalid();
    if (q.correct !== null && (!Number.isInteger(q.correct) || (q.correct as number) < 0 || (q.correct as number) >= (q.options as unknown[]).length)) invalid();
    if ((q.type === "written" || q.type === "numeric") && (q.correct !== null || (q.options as unknown[]).length !== 0)) invalid();
    if (q.type === "true-false" && ![0, 2].includes((q.options as unknown[]).length)) invalid();
    if (q.numericAnswer !== undefined && !validNumericAnswer(q.numericAnswer)) invalid();
    if (q.steps !== undefined && (!Array.isArray(q.steps) || !q.steps.every(step => typeof step === "string" && step.trim()))) invalid();
    if (q.modelAnswer !== undefined && typeof q.modelAnswer !== "string") invalid();
    if (q.difficulty !== undefined && !["Inicial", "Intermedio", "Avanzado"].includes(q.difficulty as string)) invalid();
    if (q.photoId !== undefined && !papers.get(q.examId as string)?.has(q.photoId as string)) invalid();
    if (q.verified === true && !canPractice(q as unknown as Question)) invalid();
  }
}
