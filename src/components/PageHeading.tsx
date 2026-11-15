import { assets } from "../data/assets";

export function PageHeading({
  title,
  description,
  image,
  example = false,
}: {
  title: string;
  description: string;
  image: keyof typeof assets;
  example?: boolean;
}) {
  return (
    <header className="page-heading">
      <img src={assets[image]} alt="" />
      <div>
        <span className="eyebrow">TU BIBLIOTECA DE ESTUDIO</span>
        <h1>{title}</h1>
        <p>{description}</p>
        {example && (
          <span className="example-label">
            Material introductorio de ejemplo · No son apuntes de clase
          </span>
        )}
      </div>
    </header>
  );
}
