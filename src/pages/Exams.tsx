import { MathText } from "../components/MathText";
import { useState } from "react";
import { Bookmark, Check, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useExamCatalog } from "../hooks/useExamCatalog";
import { canAttemptQuestion, canPractice, questionAnswer, questionTypeLabels } from "../data/examCatalog";
import { ExamLibrary } from "../components/ExamLibrary";
import "../styles/exams.css";
import { PageHeading } from "../components/PageHeading";
import { useStudy } from "../hooks/useStudy";
import { Practice } from "../components/Practice";
import { PracticeHistory } from "../components/PracticeHistory";

export function Exams() {
  const { state, toggleBookmark } = useStudy();
  const { catalog, questions, questionTopics, loading, error } = useExamCatalog();
  const [params, setParams] = useSearchParams();
  const examId = params.get("parcial");
  const selectedGroup = catalog.exams.find(group => group.id === examId);
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("todos");
  const [onlySaved, setOnlySaved] = useState(false);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [practice, setPractice] = useState<string[] | null>(null);
  const filtered = questions.filter(
    (question) =>
      (!examId || question.examId === examId) &&
      (topic === "todos" || question.topic === topic) &&
      (!onlySaved || state.bookmarked.includes(question.id)) &&
      `${question.prompt} ${question.tags.join(" ")}`
        .toLocaleLowerCase("es")
        .includes(search.toLocaleLowerCase("es")),
  );
  return (
    <section className="content-page exams-page">
      <PageHeading
        title="Un ensayo antes del parcial"
        description="Consultá parciales anteriores, ampliá sus fotos y armá tu propia práctica."
        image="exams"
      />
      {!practice && <ExamLibrary papers={catalog.exams} selectedId={examId} loading={loading} error={error} onSelect={id => {
        setParams(id ? { parcial: id } : {}); setSelected([]); setRevealed([]); setTopic("todos"); setSearch("");
      }} />}
      <h2 className="section-title">Preguntas {examId ? selectedGroup?.kind === "collection" ? "de este grupo" : "de este parcial" : "de práctica"}</h2>
      <p className="example-label">Tu banco de preguntas y fotografías se completará con los parciales que incorpores.</p>
      {practice ? (
        <Practice
          questions={questions.filter((question) =>
            practice.includes(question.id),
          )}
          mode="parcial"
          onClose={() => setPractice(null)}
        />
      ) : (
        <>
          <div className="panel toolbar">
            <label className="search-input">
              <Search size={18} />
              <input
                aria-label="Buscar preguntas"
                placeholder="Buscar pregunta o etiqueta…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label>
              Tema
              <select
                aria-label="Tema de pregunta"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
              >
                <option value="todos">Todos los temas</option>
                {questionTopics.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={onlySaved}
                onChange={(event) => setOnlySaved(event.target.checked)}
              />{" "}
              Solo guardadas
            </label>
          </div>
          <div className="selection-bar">
            <span>{selected.length} preguntas seleccionadas</span>
            <div className="actions">
              <button
                className="secondary"
                disabled={!filtered.some(canAttemptQuestion)}
                onClick={() =>
                  setSelected([
                    ...new Set([
                      ...selected,
                      ...filtered.filter(canAttemptQuestion).map((question) => question.id),
                    ]),
                  ])
                }
              >
                Seleccionar visibles
              </button>
              <button
                className="secondary"
                disabled={!selected.length}
                onClick={() => setSelected([])}
              >
                Limpiar selección
              </button>
              <button
                className="primary"
                disabled={!selected.length}
                onClick={() => setPractice([...selected])}
              >
                Comenzar simulacro
              </button>
            </div>
          </div>
          <div className="question-list">
            {filtered.map((question) => (
              <article className="panel question-card" key={question.id}>
                <div className="lesson-meta">
                  <span className="tag">
                    {questionTopics.find((item) => item.id === question.topic)?.title}
                  </span>
                  <span>{question.difficulty}</span>
                </div>
                <p className="question-source">{question.origin}</p>
                <h2>{question.number !== undefined && `${question.number}. `}<MathText text={question.prompt} /></h2>
                {question.examId && question.options.length > 0 && (
                  <ul className="question-original-options" aria-label="Opciones de la pregunta">
                    {question.options.map(option => <li key={option}><MathText text={option} /></li>)}
                  </ul>
                )}
                {question.reviewNote && <p className="muted">Revisar transcripción: {question.reviewNote}</p>}
                {question.examId && <p className="muted">{catalog.exams.find(paper => paper.id === question.examId)?.title} · {questionTypeLabels[question.type ?? "choice"]}</p>}
                {question.photoId && <p className="muted"><a href={`${import.meta.env.BASE_URL}${catalog.exams.find(paper => paper.id === question.examId)?.photos.find(photo => photo.id === question.photoId)?.src}`} target="_blank" rel="noreferrer" aria-label="Ver fotografía original de esta pregunta">Referencia: {catalog.exams.find(paper => paper.id === question.examId)?.photos.find(photo => photo.id === question.photoId)?.alt}</a></p>}
                {!canPractice(question) && <p className="tag">Respuesta pendiente de revisión</p>}
                <div className="tags">
                  {question.tags.map((tag) => (
                    <span className="tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="question-actions">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      disabled={!canAttemptQuestion(question)}
                      checked={selected.includes(question.id)}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? [...selected, question.id]
                            : selected.filter((id) => id !== question.id),
                        )
                      }
                    />{" "}
                    Incluir en simulacro
                  </label>
                  <button
                    className="text-button"
                    aria-pressed={state.bookmarked.includes(question.id)}
                    onClick={() => toggleBookmark(question.id)}
                  >
                    <Bookmark
                      size={16}
                      fill={
                        state.bookmarked.includes(question.id)
                          ? "currentColor"
                          : "none"
                      }
                    />
                    {state.bookmarked.includes(question.id)
                      ? "Guardada para repasar"
                      : "Guardar para repasar"}
                  </button>
                  <button
                    className="secondary"
                    disabled={!canPractice(question)}
                    aria-expanded={revealed.includes(question.id)}
                    onClick={() =>
                      setRevealed(
                        revealed.includes(question.id)
                          ? revealed.filter((id) => id !== question.id)
                          : [...revealed, question.id],
                      )
                    }
                  >
                    {revealed.includes(question.id)
                      ? "Ocultar respuesta"
                      : "Ver respuesta"}
                  </button>
                </div>
                {revealed.includes(question.id) && (
                  <div className="example-box">
                    <h3>
                      <Check size={16} /> <MathText text={questionAnswer(question)} />
                    </h3>
                    <p><MathText text={question.explanation} /></p><ol>{question.steps?.map((step, i) => <li key={i}><MathText text={step} /></li>)}</ol>
                  </div>
                )}
              </article>
            ))}
          </div>
          {!filtered.length && (
            <p className="panel">
              {questions.length ? "No hay preguntas que coincidan con los filtros." : "Todavía no hay preguntas de Probabilidad y Estadística. Agregá tus parciales para comenzar."}
            </p>
          )}
        </>
      )}
      <PracticeHistory />
    </section>
  );
}
