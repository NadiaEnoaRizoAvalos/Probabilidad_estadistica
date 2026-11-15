import { useStudy } from "../hooks/useStudy";

export function PracticeHistory() {
  const { state } = useStudy();
  const answers = state.attempts.flatMap((attempt) => attempt.answers);
  const pending = state.attempts.reduce((total, attempt) => total + (attempt.pendingAnswers?.length ?? 0), 0);
  return (
    <section className="panel history-panel">
      <h2>Tu aprendizaje en números</h2>
      <div className="learning-stats">
        <div>
          <strong>{state.attempts.length}</strong>
          <span>Prácticas completadas</span>
        </div>
        <div>
          <strong>
            {answers.length
              ? `${Math.round((answers.filter((answer) => answer.correct).length / answers.length) * 100)}%`
              : "—"}
          </strong>
          <span>Aciertos acumulados</span>
        </div>
        <div>
          <strong>{answers.filter((answer) => !answer.correct).length}</strong>
          <span>Errores para aprender</span>
        </div>
      </div>
      {!!pending && <p className="muted">{pending} {pending === 1 ? "respuesta guardada" : "respuestas guardadas"} para revisión manual; no se cuentan como aciertos ni errores.</p>}
      {answers.some(answer => answer.selfAssessed) && <p className="muted">Incluye {answers.filter(answer => answer.selfAssessed).length} respuestas autoevaluadas con un modelo; no fueron corregidas automáticamente.</p>}
      {state.attempts.length > 0 ? (
        <details>
          <summary>Ver últimos resultados</summary>
          <ul className="history-list">
            {state.attempts
              .slice(-5)
              .reverse()
              .map((attempt) => (
                <li key={attempt.id}>
                  <span>
                    {new Date(attempt.date).toLocaleDateString("es-AR")} ·{" "}
                    {attempt.mode === "parcial" ? "Simulacro" : "Repaso"}
                  </span>
                  <strong>
                    {attempt.answers.length ? `${attempt.answers.filter((answer) => answer.correct).length}/${attempt.answers.length} aciertos` : "Sin calificar"}
                  </strong>
                </li>
              ))}
          </ul>
        </details>
      ) : (
        <p className="muted">
          Todavía no hay resultados. Completá una práctica para comenzar.
        </p>
      )}
    </section>
  );
}
