import katex from "katex";
import "katex/dist/katex.min.css";

export function Formula({ expression, display = false }: { expression: string; display?: boolean }) {
  const html = katex.renderToString(expression, { displayMode: display, throwOnError: false, trust: false, strict: "ignore", maxExpand: 1000 });
  return <span className={display ? "math-display" : "math-inline"} dangerouslySetInnerHTML={{ __html: html }} />;
}

// Academic strings use $...$ inline or $$...$$ for display equations.
export function MathText({ text }: { text: string }) {
  return <>{text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g).map((part, i) =>
    part.startsWith("$$") && part.endsWith("$$") ? <Formula key={i} expression={part.slice(2, -2)} display /> :
    part.startsWith("$") && part.endsWith("$") ? <Formula key={i} expression={part.slice(1, -1)} /> : part
  )}</>;
}
