import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <section className="panel not-found">
      <h1>Esta página no está en la biblioteca</h1>
      <p>Podés volver al inicio para encontrar tu próximo tema.</p>
      <Link className="primary" to="/">
        Volver al inicio
      </Link>
    </section>
  );
}
