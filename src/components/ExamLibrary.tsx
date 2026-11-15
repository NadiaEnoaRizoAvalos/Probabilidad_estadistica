import { useState } from "react";
import { Image, Search } from "lucide-react";
import type { ExamPaper } from "../data/examCatalog";
import { ExamPhotos } from "./ExamPhotos";

export function ExamLibrary({ papers, selectedId, onSelect, loading, error }: { papers: ExamPaper[]; selectedId: string | null; onSelect: (id: string | null) => void; loading: boolean; error: boolean }) {
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("");
  const selected = papers.find(paper => paper.id === selectedId);
  if (error) return <section className="panel" role="alert">No pudimos cargar la biblioteca. Recargá la página para volver a intentar.{selectedId && <button className="secondary" onClick={() => onSelect(null)}>Volver a biblioteca</button>}</section>;
  if (selectedId && !selected) return <section className="panel"><p>{loading ? "Cargando parcial…" : "No encontramos ese parcial en la biblioteca."}</p><button className="secondary" onClick={() => onSelect(null)}>Volver a biblioteca</button></section>;
  if (selected) return <section className="panel exam-detail" aria-label="Parcial seleccionado">
    <button className="text-button" onClick={() => onSelect(null)}>← Volver a biblioteca</button>
    <h2>{selected.title}</h2><p className="muted">{selected.topic}{selected.date ? ` · ${new Date(`${selected.date}T12:00:00`).toLocaleDateString("es-AR")}` : selected.kind === "collection" ? " · Preguntas adicionales" : " · Fecha no indicada"}</p>
    {selected.materialPending && <p className="tag">Fotografía y transcripción pendientes de incorporar.</p>}
    {selected.kind === "collection" ? <p className="muted">Preguntas adicionales recopiladas para estudiar; no forman parte de los parciales fotografiados.</p> : <ExamPhotos key={selected.id} photos={selected.photos} />}
    <p className="muted">Las preguntas asociadas aparecen debajo. Las respuestas pendientes de revisión no se califican.</p>
  </section>;
  const filtered = papers.filter(paper => (!topic || paper.topic === topic) && `${paper.title} ${paper.topic} ${paper.date ?? ""}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
  return <section className="exam-library" aria-label="Biblioteca de parciales">
    <h2>Biblioteca de parciales anteriores</h2>
    {loading ? <p className="panel">Cargando parciales…</p> : !papers.length ? <div className="panel empty-exams"><Image size={30} aria-hidden="true" /><div><h3>Tus parciales anteriores, en un solo lugar</h3><p>Todavía no agregaste fotografías reales de exámenes. Cuando las incorpores, podrás consultarlas, ampliarlas y practicar sus preguntas desde acá.</p></div></div> : <>
      <div className="panel toolbar">
        <label className="search-input"><Search size={18} /><input aria-label="Buscar parciales" placeholder="Buscar parcial…" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <label>Tema<select aria-label="Tema del parcial" value={topic} onChange={event => setTopic(event.target.value)}><option value="">Todos</option>{[...new Set(papers.map(paper => paper.topic))].map(topic => <option key={topic}>{topic}</option>)}</select></label>
      </div>
      <div className="exam-grid">{filtered.map(paper => <article className="panel exam-paper" key={paper.id}>
        {paper.photos[0] ? <img src={`${import.meta.env.BASE_URL}${paper.photos[0].src}`} alt={paper.photos[0].alt} /> : <Image size={30} aria-hidden="true" />}
        <h3>{paper.title}</h3><p className="muted">{paper.topic} · {paper.date ? new Date(`${paper.date}T12:00:00`).toLocaleDateString("es-AR") : paper.kind === "collection" ? "Recopilación para estudiar" : "Fecha no indicada"}</p>
        {paper.materialPending && <p className="tag">Material pendiente de incorporar</p>}
        {paper.kind === "collection" && <p className="tag">Preguntas adicionales para estudiar</p>}
        <button className="secondary" onClick={() => onSelect(paper.id)}>Ver parcial: {paper.title}</button>
      </article>)}</div>
      {!filtered.length && <p className="panel">No hay parciales que coincidan con los filtros.</p>}
    </>}
  </section>;
}
