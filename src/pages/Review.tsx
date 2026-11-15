import { useState } from "react";
import { useExamCatalog } from "../hooks/useExamCatalog";
import { canPractice } from "../data/examCatalog";
import { recommendTopics } from "../data/recommendations";
import { PageHeading } from "../components/PageHeading";
import { Practice } from "../components/Practice";
import { PracticeHistory } from "../components/PracticeHistory";
import { useStudy } from "../hooks/useStudy";

export function Review() {
  const { state } = useStudy();
  const { questions, questionTopics: topics, error } = useExamCatalog();
  const recommendations = recommendTopics(state, questions, topics);
  const [selected, setSelected] = useState<string[]>(() =>
    recommendations.length ? recommendations.map((item) => item.topic.id) : [],
  );
  const [practice, setPractice] = useState<string[] | null>(null);
  const available = questions.filter((question) =>
    selected.includes(question.topic) && canPractice(question),
  );
  return (
    <section className="content-page">
      <PageHeading
        title="Volver a mirar, aprender un poco más"
        description="Un repaso a tu medida, guiado por tus respuestas y los temas que elijas."
        image="review"
      />
      <p className="example-label">
        Preguntas de práctica y de parciales incorporados · Recomendaciones basadas en tus resultados locales
      </p>
      {error && <p role="alert" className="panel">No se pudo cargar el catálogo de parciales. Volvé a intentar recargando la página.</p>}
      {practice ? (
        <Practice
          questions={questions.filter((question) =>
            practice.includes(question.id),
          )}
          mode="repaso"
          onClose={() => setPractice(null)}
        />
      ) : (
        <>
          <section className="panel recommendations">
            <h2>¿Por dónde seguimos?</h2>
            {recommendations.length ? (
              <>
                <p>
                  Estos temas tienen errores en tu respuesta más reciente a cada
                  pregunta. Un nuevo acierto elimina esa recomendación.
                </p>
                <div className="recommendation-list">
                  {recommendations.map((item) => (
                    <button
                      key={item.topic.id}
                      onClick={() => setSelected([item.topic.id])}
                    >
                      <span>{item.topic.title}</span>
                      <small>
                        {item.errors}{" "}
                        {item.errors === 1
                          ? "pregunta para revisar"
                          : "preguntas para revisar"}{" "}
                        →
                      </small>
                    </button>
                  ))}
                </div>
                <button
                  className="secondary"
                  onClick={() =>
                    setSelected(recommendations.map((item) => item.topic.id))
                  }
                >
                  Elegir temas recomendados
                </button>
              </>
            ) : (
              <p className="muted">
                {state.attempts.length
                  ? "No tenés errores pendientes en las últimas respuestas registradas. Podés seguir practicando cualquier tema."
                  : "Todavía no hay respuestas para recomendarte temas. Elegí lo que quieras practicar; usaremos tus resultados para orientarte."}
              </p>
            )}
          </section>
          <section className="panel review-picker">
            <h2>Elegí tus temas</h2>
            {!topics.length && <p>Aún no hay ejercicios de Probabilidad y Estadística. Cuando incorpores material verificado, podrás practicar resultados numéricos y comparar desarrollos con respuestas modelo.</p>}
            <div className="topic-picker">
              {topics.map((topic) => (
                <label
                  key={topic.id}
                  className={selected.includes(topic.id) ? "selected" : ""}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(topic.id)}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...selected, topic.id]
                          : selected.filter((id) => id !== topic.id),
                      )
                    }
                  />
                  <span>
                    {topic.title}
                    <small>
                      {state.completed[topic.id]
                        ? "Ya estudiado"
                        : "Pendiente de estudio"}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            <div className="actions">
              <button
                className="primary"
                disabled={!available.length}
                onClick={() =>
                  setPractice(available.map((question) => question.id))
                }
              >
                Practicar {available.length}{" "}
                {available.length === 1 ? "pregunta" : "preguntas"}
              </button>
              <button
                className="secondary"
                onClick={() =>
                  setSelected(
                    selected.length === topics.length
                      ? []
                      : topics.map((topic) => topic.id),
                  )
                }
              >
                {selected.length === topics.length
                  ? "Quitar selección"
                  : "Elegir todos"}
              </button>
            </div>
          </section>
        </>
      )}
      <PracticeHistory />
    </section>
  );
}
