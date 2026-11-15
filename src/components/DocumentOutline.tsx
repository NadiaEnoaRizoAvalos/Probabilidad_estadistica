import { useEffect, useMemo, useState } from "react";
import { ChevronDown, List, Search } from "lucide-react";
import type { TheoryBlock } from "../types/theory";
import { normalizeSearch, theoryHeadings } from "./theoryHeadings";

export function DocumentOutline({ blocks }: { blocks: TheoryBlock[] }) {
  const headings = useMemo(() => theoryHeadings(blocks), [blocks]);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(headings[0]?.id);
  const [expanded, setExpanded] = useState(() => window.matchMedia("(min-width: 1180px)").matches);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1180px)");
    const update = () => setExpanded(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = headings[0]?.id;
      for (const heading of headings) {
        const element = document.getElementById(heading.id);
        if (element?.getClientRects().length && element.getBoundingClientRect().top <= 120) current = heading.id;
      }
      setActive(current);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [headings]);

  function navigate(id: string) {
    const element = document.getElementById(id);
    if (!element) return;
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
    }
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    setActive(id);
  }

  const filtered = headings.filter(heading => normalizeSearch(heading.title).includes(normalizeSearch(search)));
  return (
    <aside className="document-outline" aria-label="Índice del documento">
      <details className="panel" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
        <summary><List size={17} /><span>En esta página</span><ChevronDown className="outline-chevron" size={16} /></summary>
        <div className="outline-body">
          <label className="search-input outline-search">
            <Search size={15} />
            <input aria-label="Buscar encabezados" placeholder="Buscar un título…" value={search} onChange={event => setSearch(event.target.value)} />
          </label>
          <nav aria-label="Secciones del documento" className="outline-links">
            {filtered.map(heading => (
              <button key={heading.id} className={`outline-level-${heading.level}`} aria-current={active === heading.id ? "location" : undefined} onClick={() => navigate(heading.id)}>
                {heading.title || "Encabezado sin texto"}
              </button>
            ))}
            {!headings.length && <p className="muted">Este resumen no tiene encabezados.</p>}
            {!!headings.length && !filtered.length && <p className="muted">No hay encabezados para esa búsqueda.</p>}
          </nav>
        </div>
      </details>
    </aside>
  );
}
