import { readFile } from "node:fs/promises";
import { validateExamCatalog } from "../src/data/examCatalog.ts";

const data: unknown = JSON.parse(await readFile("public/exams/catalog.json", "utf8"));
validateExamCatalog(data);
for (const exam of data.exams) {
  for (const photo of exam.photos) {
    const bytes = await readFile(`public/${photo.src}`);
    if (!bytes.length) throw new Error("Fotografía de examen vacía");
  }
}
process.stdout.write("Catálogo y fotografías de parciales validados.\n");
