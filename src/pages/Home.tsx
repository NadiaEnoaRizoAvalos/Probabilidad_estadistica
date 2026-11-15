import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  Lightbulb,
} from "lucide-react";
import { assets } from "../data/assets";
import { useStudy } from "../hooks/useStudy";
import { progress, completedActivities, daysUntilExam } from "../hooks/studyStorage";
import { activities } from "../data/topics";
import "../styles/home-study.css";

const modules = [
  {
    title: "Teoría",
    description: "Conceptos, definiciones y ejemplos para aprender.",
    image: "theory",
    path: "/teoria",
    note: "Entendé las bases",
  },
  {
    title: "Laboratorio de Estadística",
    description: "Un espacio para explorar datos, ejercicios y simuladores.",
    image: "laboratory",
    path: "/laboratorio",
    note: "Conectá las ideas",
  },
  {
    title: "Parciales",
    description: "Exámenes anteriores, fotografías y preguntas de práctica.",
    image: "exams",
    path: "/parciales",
    note: "Ponete a prueba",
  },
  {
    title: "Apoyo inteligente",
    description:
      "Preguntas organizadas según los temas que necesitás reforzar.",
    image: "review",
    path: "/repaso",
    note: "Afianzá lo aprendido",
  },
] as const;
const tips = [
  "Aplicá lo aprendido con ejemplos reales. ¡La práctica te ayuda a consolidar mejor!",
  "Anotá los datos y qué te pide el enunciado antes de resolver un ejercicio.",
  "Al terminar un tema, intentá explicarlo con tus propias palabras.",
  "Revisá las unidades y la precisión del resultado antes de terminar.",
];

export function Home() {
  const { state, setExamDate } = useStudy();
  const dialog = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState(state.examDate);
  const percent = progress(state);
  const completed = completedActivities(state);
  const days = daysUntilExam(state.examDate);
  const next = activities.find((activity) => !state.completed[activity.id]);
  const [day] = useState(() => Math.floor(Date.now() / 86400000));
  return (
    <div className="dashboard">
      <h1 className="sr-only">Mi biblioteca de Probabilidad y Estadística</h1>
      <img
        className="grid-leaves leaves-upper-left"
        src={assets.leaves}
        alt=""
        aria-hidden="true"
      />
      <img
        className="grid-leaves leaves-lower-right"
        src={assets.leaves}
        alt=""
        aria-hidden="true"
      />
      <section className="stats-grid" aria-label="Tu estudio en un vistazo">
        <Link to="/ruta" className="stat-card">
          <BarChart3 className="stat-icon" />
          <div>
            <h2>Tu progreso</h2>
            <div className="progress-row">
              <div
                className="progress-track"
                role="progressbar"
                aria-label="Progreso general"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${percent}%` }} />
              </div>
              <strong>{percent}%</strong>
            </div>
            <small>
              {completed} de {activities.length}{" "}
              actividades completadas
              {completed < activities.length && <span> · {activities.length - completed} pendientes</span>}
            </small>
          </div>
        </Link>
        <button
          className="stat-card schedule-card"
          onClick={() => {
            setDate(state.examDate);
            dialog.current?.showModal();
          }}
        >
          <CalendarDays className="stat-icon" />
          <div>
            <h2>Fecha del parcial</h2>
            <p>{state.examDate ? new Date(`${state.examDate}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }) : "Configurar fecha"}</p>
            {days !== null && <p>{days > 0 ? `Faltan ${days} ${days === 1 ? "día" : "días"}` : days === 0 ? "El parcial es hoy" : `La fecha pasó hace ${-days} ${days === -1 ? "día" : "días"}`}</p>}
            {state.examDate && <span className="date-edit">Modificar fecha <ChevronRight size={12} aria-hidden="true" /></span>}
          </div>
        </button>
      </section>
      <section className="module-grid" aria-label="Tu biblioteca">
        {modules.map((module, index) => (
          <Link to={module.path} className="module-card" key={module.path}>
            <div className="module-topline">
              <span className="module-number">0{index + 1}</span>
              <span className="module-note">{module.note}</span>
            </div>
            <div className="module-art">
              <img src={assets[module.image]} alt="" />
            </div>
            <div className="module-copy">
              <h2>{module.title}</h2>
              <p>{module.description}</p>
            </div>
            <span className="circle-arrow">
              <ChevronRight size={17} />
            </span>
          </Link>
        ))}
      </section>
      <section className="bottom-grid" aria-label="Seguí aprendiendo">
        <Link to="/ruta" className="route-card">
          <img className="reading-bunny" src={assets.reading} width={545} height={484} alt="" />
          <div className="route-copy">
            <h2>Ruta de estudio</h2>
            <p>
              {next
                ? "Sigue un orden sugerido para avanzar de forma organizada y efectiva."
                : activities.length ? "¡Completaste tu recorrido! Volvé a tus temas cuando quieras." : "Tu recorrido se armará cuando incorpores el material de la materia."}
            </p>
            <span className="small-button">
              Ver ruta <ChevronRight size={13} />
            </span>
          </div>
        </Link>
        <p className="daily-tip">
          <Lightbulb size={16} aria-hidden="true" />
          <span><strong>Consejo del día</strong> · {tips[day % tips.length]}</span>
        </p>
      </section>
      <dialog ref={dialog} className="settings-dialog">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setExamDate(date);
            dialog.current?.close();
          }}
        >
          <span className="eyebrow">UN MOMENTO PARA VOS</span>
          <h2>Fecha del parcial</h2>
          <label>
            Fecha del próximo parcial
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <p className="muted">El avance cuenta los resúmenes publicados y la práctica cuando haya preguntas disponibles. Sirve para organizarte; no predice una nota.</p>
          <div className="actions">
            <button
              type="button"
              className="secondary"
              onClick={() => dialog.current?.close()}
            >
              Cancelar
            </button>
            <button className="primary" type="submit">
              Guardar fecha
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
