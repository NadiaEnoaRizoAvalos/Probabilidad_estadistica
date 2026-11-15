import { PageHeading } from "../components/PageHeading";
import { laboratoryModules } from "../data/laboratory";
import "../styles/laboratory.css";

export function StatisticsLab() {
  return <section className="content-page">
    <PageHeading title="Laboratorio de Estadística" description="Un espacio para aprender haciendo, a tu ritmo." image="laboratory" />
    <p className="panel">Las herramientas se incorporarán con el programa y los ejercicios de tu materia. Estas categorías organizan el laboratorio; todavía no contienen calculadoras ni simuladores.</p>
    <div className="laboratory-grid">{laboratoryModules.map(module => <article className="panel" key={module.id}>
      <span className="tag">Próximamente · pendiente de material</span>
      <h2>{module.title}</h2><p>{module.description}</p>
    </article>)}</div>
  </section>;
}
