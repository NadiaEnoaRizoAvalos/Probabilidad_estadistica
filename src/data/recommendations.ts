import { canPractice } from "./examCatalog";
import { questions } from "./questions";
import { topics } from "./topics";
import type { StudyState, Question } from "../types";

export function recommendTopics(state: StudyState, bank: Question[] = questions, topicList: { id: string; title: string }[] = topics) {
  const latest = new Map<string, boolean>();
  for (const attempt of state.attempts) {
    for (const answer of attempt.answers)
      latest.set(answer.questionId, answer.correct);
  }
  return topicList
    .map((topic) => ({
      topic,
      errors: bank.filter(
        (question) =>
          question.topic === topic.id && canPractice(question) && latest.get(question.id) === false,
      ).length,
    }))
    .filter((item) => item.errors > 0)
    .sort((a, b) => b.errors - a.errors);
}
