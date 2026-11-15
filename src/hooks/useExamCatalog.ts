import { useEffect, useState } from "react";
import { emptyExamCatalog, validateExamCatalog, type ExamCatalog } from "../data/examCatalog";
import { questions as examples } from "../data/questions";
import { topics } from "../data/topics";

export function useExamCatalog() {
  const [catalog, setCatalog] = useState<ExamCatalog>(emptyExamCatalog);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}exams/catalog.json`, { signal: controller.signal, cache: "no-cache" })
      .then(response => { if (!response.ok) throw new Error("Catálogo no disponible"); return response.json(); })
      .then((value: unknown) => {
        validateExamCatalog(value);
        if (value.questions.some(q => examples.some(example => example.id === q.id))) throw new Error("Identificador de pregunta repetido");
        setCatalog(value);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  const questions = [...examples, ...catalog.questions];
  const questionTopics = [...new Set(questions.map(q => q.topic))].map(id => ({ id, title: topics.find(topic => topic.id === id)?.title ?? id }));
  return { catalog, questions, questionTopics, loading, error };
}
