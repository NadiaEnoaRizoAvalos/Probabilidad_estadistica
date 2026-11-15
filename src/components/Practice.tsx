import { MathText } from "./MathText";
import { numericMatches, parseNumericAnswer } from "../data/numericAnswers";
import { useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import type { Attempt, Question } from "../types";
import { useStudy } from "../hooks/useStudy";
import { topics } from "../data/topics";
import { questionAnswer } from "../data/examCatalog";
import { Link } from "react-router-dom";
import { ExamSimulation } from "./ExamSimulation";

export function Practice(props: Parameters<typeof ReviewPractice>[0]) {
  return props.mode === "parcial" ? <ExamSimulation questions={props.questions} onClose={props.onClose} /> : <ReviewPractice {...props} />;
}

function ReviewPractice({
  questions,
  mode,
  onClose,
}: {
  questions: Question[];
  mode: Attempt["mode"];
  onClose: () => void;
}) {
  const { saveAttempt } = useStudy();
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Attempt["answers"]>([]);
  const [finished, setFinished] = useState(false);
  const [draft, setDraft] = useState("");
  const [modelShown, setModelShown] = useState(false);
  const current = questions[index];
  const revealed = answers.length > index;
  const correct = answers.filter((answer) => answer.correct).length;
  function next() {
    if (index === questions.length - 1) {
      saveAttempt({
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        mode,
        answers,
      });
      setFinished(true);
    } else {
      setIndex(index + 1);
      setChoice(null);
      setDraft(""); setModelShown(false);
    }
  }
  if (finished)
    return (
      <section className="panel practice-result" aria-live="polite">
        <span className="eyebrow">CADA INTENTO ES UN APRENDIZAJE</span>
        <h2>¡Práctica completada!</h2>
        <div className="result-score">
          {correct}
          <span> / {questions.length}</span>
        </div>
        <p>
          Respuestas correctas ·{" "}
          {Math.round((correct / questions.length) * 100)}%
        </p>
        <p className="muted">
          El resultado se guardó en tu navegador. Los errores alimentan tus
          recomendaciones de repaso.
        </p>
        <div className="answer-review">
          {answers.map((answer, i) => (
            <div key={answer.questionId}>
              {answer.correct ? <Check size={18} /> : <X size={18} />}
              <div>
                <h3><MathText text={questions[i].prompt} /></h3>
                {answer.selfAssessed && <small>Resultado autoevaluado con respuesta modelo</small>}
                <p>Respuesta: <MathText text={questionAnswer(questions[i])} /></p>
                {!answer.correct && (
                  <Link to="/repaso">
                    Repasar{" "}
                    {
                      topics.find((topic) => topic.id === questions[i].topic)
                        ?.title ?? questions[i].topic
                    }{" "}
                    →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
        <button className="primary" onClick={onClose}>
          Volver a elegir preguntas
        </button>
      </section>
    );
  if (!current) return <section className="panel"><p>No hay preguntas disponibles.</p><button onClick={onClose}>Volver</button></section>;
  return (
    <section className="panel practice-panel">
      <div className="lesson-meta">
        <span className="tag">
          {mode === "parcial" ? "Simulacro de práctica" : "Repaso"} ·{" "}
          {index + 1} de {questions.length}
        </span>
        <span>{current.difficulty}</span>
      </div>
      <p className="question-source">{current.origin}</p>
      <h2><MathText text={current.prompt} /></h2>
      {current.type === "numeric" ? <label>Tu resultado<input aria-label="Tu resultado" inputMode="decimal" value={draft} disabled={revealed} onChange={event => setDraft(event.target.value)} /></label> : current.type === "written" ? <div className="written-practice">
        <label>Tu respuesta<textarea aria-label="Tu respuesta" rows={6} value={draft} disabled={modelShown} onChange={event => setDraft(event.target.value)} /></label>
        {!modelShown ? <button className="primary" disabled={!draft.trim()} onClick={() => setModelShown(true)}>Comparar con respuesta modelo</button> : <div className="example-box"><h3>Respuesta modelo</h3><p><MathText text={questionAnswer(current)} /></p><ol>{current.steps?.map((step, i) => <li key={i}><MathText text={step} /></li>)}</ol><p className="muted">Compará tu respuesta y registrá tu autoevaluación. La aplicación no corrige automáticamente el texto.</p>
          {!revealed && <div className="actions">{[true, false].map(correct => <button key={String(correct)} className="secondary" onClick={() => setAnswers([...answers, { questionId: current.id, correct, selfAssessed: true }])}>{correct ? "Coincide con el modelo" : "Necesito repasar"}</button>)}</div>}
        </div>}
      </div> : <fieldset className="answer-options">
        <legend className="sr-only">Elegí una respuesta</legend>
        {current.options.map((option, optionIndex) => (
          <label
            key={option}
            className={`answer-option ${choice === optionIndex ? "chosen" : ""} ${revealed && optionIndex === current.correct ? "correct-option" : ""}`}
          >
            <input
              type="radio"
              name="answer"
              checked={choice === optionIndex}
              disabled={revealed}
              onChange={() => setChoice(optionIndex)}
            />
            <span>{String.fromCharCode(65 + optionIndex)}</span>
            <MathText text={option} />
          </label>
        ))}
      </fieldset>}
      {revealed ? (
        <div
          className={`feedback ${answers[index].correct ? "success" : ""}`}
          role="status"
        >
          <h3>
            {answers[index].correct
              ? answers[index].selfAssessed ? "Autoevaluación registrada" : "¡Muy bien!"
              : "Vamos a repasar esta idea"}
          </h3>
          {current.type === "numeric" && <p>Resultado esperado: {questionAnswer(current)}</p>}
          <p><MathText text={current.explanation} /></p><ol>{current.steps?.map((step, i) => <li key={i}><MathText text={step} /></li>)}</ol>
          <button className="primary" onClick={next}>
            {index === questions.length - 1
              ? "Guardar y ver resultado"
              : "Siguiente pregunta"}
            <ChevronRight size={16} />
          </button>
        </div>
      ) : current.type !== "written" ? (
        <button
          className="primary"
          disabled={current.type === "numeric" ? parseNumericAnswer(draft) === null : choice === null}
          onClick={() =>
            setAnswers([
              ...answers,
              { questionId: current.id, correct: current.type === "numeric" ? numericMatches(draft, current.numericAnswer) : choice === current.correct },
            ])
          }
        >
          Comprobar respuesta
        </button>
      ) : null}
      <div className="practice-exit">
        <button className="text-button" onClick={onClose}>
          Salir sin guardar este intento
        </button>
        <small>Se guarda al finalizar todas las preguntas.</small>
      </div>
    </section>
  );
}
