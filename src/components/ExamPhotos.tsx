import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus, X } from "lucide-react";
import type { ExamPhoto } from "../data/examCatalog";

export function ExamPhotos({ photos }: { photos: ExamPhoto[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const photo = photos[index];
  function show(next: number) { setIndex(next); setZoom(1); }
  return <>
    <div className="exam-thumbnails">
      {photos.map((photo, i) => <button key={photo.id} onClick={() => { show(i); dialog.current?.showModal(); }} aria-label={`Ampliar fotografía ${i + 1}`}>
        <img src={`${import.meta.env.BASE_URL}${photo.src}`} alt={photo.alt} />
        <span><Maximize2 size={14} /> Fotografía {i + 1}</span>
      </button>)}
    </div>
    {!photos.length && <p className="muted">Este parcial todavía no tiene fotografías.</p>}
    <dialog ref={dialog} className="exam-photo-dialog" aria-label="Visor de fotografías" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      {photo && <>
        <div className="photo-controls">
          <strong>Fotografía {index + 1} de {photos.length}</strong>
          <button className="secondary" aria-label="Reducir imagen" disabled={zoom === 1} onClick={() => setZoom(Math.max(1, zoom - .5))}><Minus size={17} /></button>
          <button className="secondary" aria-label="Ampliar imagen" disabled={zoom === 3} onClick={() => setZoom(Math.min(3, zoom + .5))}><Plus size={17} /></button>
          <a className="secondary" href={`${import.meta.env.BASE_URL}${photo.src}`} target="_blank" rel="noreferrer">Abrir original</a>
          <button className="secondary" aria-label="Cerrar visor" onClick={() => dialog.current?.close()}><X size={17} /></button>
        </div>
        <div className="photo-canvas"><img src={`${import.meta.env.BASE_URL}${photo.src}`} alt={photo.alt} style={zoom > 1 ? { width: `${zoom * 100}%`, maxWidth: "none", maxHeight: "none" } : undefined} /></div>
        <div className="photo-controls">
          <button className="secondary" disabled={index === 0} onClick={() => show(index - 1)}><ChevronLeft size={16} /> Anterior</button>
          <span className="muted">{photo.alt}</span>
          <button className="secondary" disabled={index === photos.length - 1} onClick={() => show(index + 1)}>Siguiente <ChevronRight size={16} /></button>
        </div>
      </>}
    </dialog>
  </>;
}
