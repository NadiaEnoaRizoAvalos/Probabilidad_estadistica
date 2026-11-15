import { activities, topics } from "../data/topics";
import type { StudyState } from "../types";

export const storageKey = "probabilidad-estadistica-estudio-v1";
export const emptyState: StudyState = {
  completed: {},
  bookmarked: [],
  examDate: "",
  attempts: [],
};

export function parseStudyState(value: string | null): StudyState {
  if (!value) return { ...emptyState };
  try {
    const data = JSON.parse(value);
    const ids = new Set([...activities, ...topics].map((activity) => activity.id));
    return {
      completed: Object.fromEntries(
        Object.entries(data.completed ?? {}).filter(
          (entry): entry is [string, string] =>
            (ids.has(entry[0]) || /^notion-[a-f0-9]{32}$/.test(entry[0])) &&
            typeof entry[1] === "string" &&
            Number.isFinite(Date.parse(entry[1])),
        ),
      ),
      bookmarked: Array.isArray(data.bookmarked)
        ? data.bookmarked.filter((id: unknown) => typeof id === "string")
        : [],
      examDate: validCalendarDate(data.examDate) ? data.examDate : "",
      attempts: Array.isArray(data.attempts)
        ? data.attempts.filter((attempt: unknown) => {
          if (!attempt || typeof attempt !== "object") return false;
          const a = attempt as Record<string, unknown>;
          const pending = a.pendingAnswers;
          const validPending = pending === undefined || (Array.isArray(pending) && pending.every(answer =>
            !!answer && typeof answer === "object" && typeof answer.questionId === "string" && typeof answer.response === "string" && !!answer.response.trim(),
          ));
          return (
            typeof a.id === "string" &&
            typeof a.date === "string" &&
            Number.isFinite(Date.parse(a.date)) &&
            (a.mode === "parcial" || a.mode === "repaso") &&
            Array.isArray(a.answers) &&
            (a.answers.length > 0 || (Array.isArray(pending) && pending.length > 0)) &&
            validPending &&
            a.answers.every(
              (answer: unknown) =>
                !!answer &&
                typeof answer === "object" &&
                typeof (answer as Record<string, unknown>).questionId ===
                "string" &&
                typeof (answer as Record<string, unknown>).correct ===
                "boolean",
            )
          );
        })
        : [],
    };
  } catch {
    return { ...emptyState };
  }
}

export function validCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && date.getFullYear() === Number(value.slice(0, 4)) && date.getMonth() + 1 === Number(value.slice(5, 7)) && date.getDate() === Number(value.slice(8, 10));
}

export function daysUntilExam(date: string, today = new Date()): number | null {
  if (!validCalendarDate(date)) return null;
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
}

export function completedActivities(state: StudyState): number {
  return activities.filter(activity => !!state.completed[activity.id]).length;
}

export function progress(state: StudyState): number {
  if (!activities.length) return 0;
  return Math.round(
    (completedActivities(state) /
      activities.length) *
    100,
  );
}
