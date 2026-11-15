import { MathText } from "./MathText";
import { numericMatches, parseNumericAnswer } from "../data/numericAnswers";
import { useState } from "react";
import type { Attempt, Question } from "../types";
import { canPractice, questionAnswer, questionTypeLabels } from "../data/examCatalog";
import { useStudy } from "../hooks/useStudy";

interface ExamResponse { questionId: string; choice: number | null; text: string }
const responseText = (q: Question, response: ExamResponse) => (q.type === "written" || q.type === "numeric") ? response.text : q.options[response.choice ?? -1] ?? "";
const automaticallyGraded = (q: Question) => q.type !== "written" && canPractice(q);

export function ExamSimulation({ questions, onClose }: { questions: Question[]; onClose: () => void }) {
  const { saveAttempt } = useStudy();
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [responses, setResponses] = useState<ExamResponse[]>([]);
  const [finished, setFinished] = useState(false);
  const current = questions[index];

  function next() {
    const nextResponses = [...responses, { questionId: current.id, choice, text: draft }];
    setResponses(nextResponses);
    if (index === questions.length - 1) {
      const answers: Attempt["answers"] = [], pendingAnswers: NonNullable<Attempt["pendingAnswers"]> = [];
      nextResponses.forEach((response, i) => {
        const question = questions[i];
        if (automaticallyGraded(question)) answers.push({ questionId: question.id, correct: question.type === "numeric" ? numericMatches(response.text, question.numericAnswer) : response.choice === question.correct });
        else pendingAnswers.push({ questionId: question.id, response: responseText(question, response) });
      });
      saveAttempt({ id: crypto.randomUUID(), date: new Date().toISOString(), mode: "parcial", answers, ...(pendingAnswers.length ? { pendingAnswers } : {}) });
      setFinished(true);
    } else {
      setIndex(index + 1); setChoice(null); setDraft("");
    }
  }

  if (finished) {
    const graded = questions.filter(automaticallyGraded).length;
    const pending = questions.length - graded;
    const correct = responses.filter((response, i) => automaticallyGraded(questions[i]) && (questions[i].type === "numeric" ? numericMatches(response.text, questions[i].numericAnswer) : response.choice === questions[i].correct)).length;
    return <section className="panel practice-result" aria-live="polite">
      <span className="eyebrow">REVISÁ TU RECORRIDO</span>
      <h2>¡Simulacro completado!</h2>
      {graded ? <><div className="result-score">{correct}<span> / {graded}</span></div><p>Respuestas correctas entre las preguntas con corrección verificada.</p></> : <p>Sin calificación: este intento no contiene preguntas con corrección automática verificada.</p>}
      {!!pending && <p className="muted">{pending} {pending === 1 ? "respuesta guardada" : "respuestas guardadas"} para revisión manual. No se cuenta como acierto ni error una respuesta sin calificar.</p>}
      <div className="answer-review">{responses.map((response, i) => {
        const question = questions[i];
        return <div key={question.id}><div>
          <p className="question-source">{question.origin}</p>
          <h3>{question.number !== undefined && `${question.number}. `}<MathText text={question.prompt} /></h3>
          <p className="student-response">Tu respuesta: {responseText(question, response)}</p>
          {canPractice(question) ? <><h4>{question.type === "written" ? "Respuesta modelo" : question.verified === true ? "Respuesta verificada" : "Respuesta de práctica"}</h4><p><MathText text={questionAnswer(question)} /></p>{question.explanation && <p><MathText text={question.explanation} /></p>}<ol>{question.steps?.map((step, i) => <li key={i}><MathText text={step} /></li>)}</ol>{question.type === "written" && <small>Compará tu respuesta con el modelo; no se corrige automáticamente el texto.</small>}</> : <p className="tag">Respuesta pendiente de revisión</p>}
        </div></div>;
      })}</div>
      <button className="primary" onClick={onClose}>Volver a elegir preguntas</button>
    </section>;
  }
  if (!current) return <section className="panel"><p>No hay preguntas seleccionadas.</p><button className="secondary" onClick={onClose}>Volver a elegir preguntas</button></section>;
  return <section className="panel practice-panel">
    <div className="lesson-meta"><span className="tag">Simulacro de práctica · {index + 1} de {questions.length}</span><span>{questionTypeLabels[current.type ?? "choice"]}</span></div>
    <p className="question-source">{current.origin}</p>
    <h2>{current.number !== undefined && `${current.number}. `}<MathText text={current.prompt} /></h2>
    <p className="muted">Las respuestas y explicaciones se muestran al finalizar. Las preguntas sin respuesta verificada se guardan sin calificar.</p>
    {current.type === "numeric" ? <label>Tu resultado<input aria-label="Tu resultado" inputMode="decimal" value={draft} onChange={event => setDraft(event.target.value)} /></label> : current.type === "written" ? <div className="written-practice"><label>Tu respuesta<textarea aria-label="Tu respuesta" rows={6} value={draft} onChange={event => setDraft(event.target.value)} /></label></div> : <fieldset className="answer-options">
      <legend className="sr-only">Elegí una respuesta</legend>
      {current.options.map((option, optionIndex) => <label key={`${current.id}-${optionIndex}`} className={`answer-option ${choice === optionIndex ? "chosen" : ""}`}>
        <input type="radio" name="answer" checked={choice === optionIndex} onChange={() => setChoice(optionIndex)} /><span>{String.fromCharCode(65 + optionIndex)}</span><MathText text={option} />
      </label>)}
    </fieldset>}
    <button className="primary" disabled={current.type === "numeric" ? parseNumericAnswer(draft) === null : current.type === "written" ? !draft.trim() : choice === null} onClick={next}>{index === questions.length - 1 ? "Finalizar simulacro" : "Guardar respuesta y continuar"}</button>
    <div className="practice-exit"><button className="text-button" onClick={onClose}>Salir sin guardar este intento</button><small>Se guarda al finalizar todas las preguntas.</small></div>
  </section>;
}
