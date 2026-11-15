import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Heart, Home, Sparkles, BookOpen, ChartNoAxesCombined, ClipboardList, Brain, Map,
} from "lucide-react";
import { assets } from "../data/assets";
import { useStudy } from "../hooks/useStudy";

const navigation = [
  { path: "/", label: "Inicio", icon: Home },
  { path: "/teoria", label: "Teoría", icon: BookOpen },
  { path: "/laboratorio", label: "Laboratorio de Estadística", icon: ChartNoAxesCombined },
  { path: "/parciales", label: "Parciales", icon: ClipboardList },
  { path: "/repaso", label: "Apoyo inteligente", icon: Brain },
  { path: "/ruta", label: "Ruta de estudio", icon: Map },
];

export function Layout() {
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  const initial = useRef(true);
  const { storageError } = useStudy();
  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    main.current?.focus();
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <div className={`library ${location.pathname === "/" ? "library-home" : "library-inner"}`}>
      <a
        href="#contenido"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
          main.current?.scrollIntoView();
        }}
      >
        Saltar al contenido
      </a>
      {location.pathname !== "/" && (
        <div className="room-decor" aria-hidden="true">
          <div className="room-corner">
            <div className="window">
              <span className="window-sun" />
              <span className="window-cloud" />
            </div>
            <img className="window-plant" src={assets.leaves} alt="" />
            <div className="wall-shelf"><i /><i /><i /></div>
          </div>
        </div>
      )}
      <header className="site-header">
        <div className="brand">
          <div>
            <Link to="/" className="brand-title">
              Probabilidad y <em>Estadística</em>
            </Link>
            <p>Estudia · Practica · Repasa · Avanza</p>
            <div className="brand-divider">
              <span />
              <Heart size={13} />
              <span />
            </div>
          </div>
        </div>
        {location.pathname === "/" && (
          <div className="home-room" aria-hidden="true">
            <div className="window">
              <span className="window-sun" />
              <span className="window-cloud" />
            </div>
            <img className="resting-bunny" src={assets.resting} alt="" />
          </div>
        )}
      </header>
      <nav className="module-nav" aria-label="Secciones de estudio">
        {navigation.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} end={path === "/"}>
            <Icon size={16} aria-hidden="true" /><span>{label}</span>
          </NavLink>
        ))}

      </nav>
      {storageError && (
        <p className="storage-alert" role="alert">
          No se pudo guardar en este navegador. Tu progreso actual solo se
          conservará mientras mantengas abierta la página.
        </p>
      )}
      <main id="contenido" ref={main} tabIndex={-1}>
        <Outlet />
      </main>
      {location.pathname !== "/" && <footer className="site-footer">
        <Sparkles size={14} />
        <span>Un poquito cada día, un gran paso en tu aprendizaje.</span>
        <Heart size={13} />
      </footer>}
    </div>
  );
}
