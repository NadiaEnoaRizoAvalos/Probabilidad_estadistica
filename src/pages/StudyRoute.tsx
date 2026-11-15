import { Link } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";
import { activities } from "../data/topics";
import { useStudy } from "../hooks/useStudy";
import { progress } from "../hooks/studyStorage";
import { PageHeading } from "../components/PageHeading";

export function StudyRoute() {
  const { state, toggleComplete } = useStudy();
  const next = activities.find((activity) => !state.completed[activity.id]);
  return (
    <section className="content-page">
      <PageHeading
        title="Tu ruta de estudio"
        description="Un paso a la vez también es avanzar. El recorrido se construye con el material que publiques."
        image="theory"
      />
      <div className="panel route-summary">
        <div>
          <span className="eyebrow">ASÍ VAS CRECIENDO</span>
          <h2>{progress(state)}% de tu recorrido</h2>
          <p>
            {next
              ? `Tu siguiente paso sugerido: ${next.title}.`
              : activities.length ? "¡Completaste todas las actividades disponibles!" : "Todavía no hay actividades. La ruta se armará con tus apuntes y parciales."}
          </p>
        </div>
        {next && (
          <Link className="primary" to={next.path}>
            Continuar <ChevronRight size={16} />
          </Link>
        )}
      </div>
      <ol className="study-steps">
        {activities.map((activity, index) => (
          <li className="panel" key={activity.id}>
            <button
              className={`completion-check ${state.completed[activity.id] ? "done" : ""}`}
              aria-label={`${state.completed[activity.id] ? "Marcar pendiente" : "Completar"}: ${activity.title}`}
              aria-pressed={!!state.completed[activity.id]}
              onClick={() => toggleComplete(activity.id)}
            >
              {state.completed[activity.id] ? <Check size={20} /> : index + 1}
            </button>
            <div>
              <h2>{activity.title}</h2>
              <small>
                {state.completed[activity.id] ? "Completado" : "Pendiente"}
              </small>
            </div>
            <Link to={activity.path} aria-label={`Abrir ${activity.title}`}>
              <ChevronRight />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
