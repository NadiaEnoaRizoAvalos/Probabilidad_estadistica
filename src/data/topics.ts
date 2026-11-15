import snapshot from "../../public/notion-theory.json" with { type: "json" };
import catalog from "../../public/exams/catalog.json" with { type: "json" };
import type { TheoryDocument } from "../types/theory";
import type { Topic } from "../types";

export const topics: Topic[] = [];
const publishedDocuments: Pick<TheoryDocument, "id" | "title">[] = snapshot.documents;
export const activities = [
  ...publishedDocuments.map(document => ({ id: document.id, title: document.title, path: `/teoria?tema=${document.id}` })),
  ...(catalog.questions.length ? [{ id: "practica", title: "Completar una práctica de preguntas", path: "/parciales" }] : []),
];
