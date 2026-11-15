import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateTheory } from "../src/types/theory.ts";
import type { TheoryBlock } from "../src/types/theory.ts";

const data: unknown = JSON.parse(await readFile("public/notion-theory.json", "utf8"));
validateTheory(data);
async function checkImage(src: string) {
  const bytes = await readFile(`public/${src}`);
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error("Imagen local inválida");
  if (createHash("sha256").update(bytes).digest("hex") !== src.split("/")[1].split(".")[0]) throw new Error("Imagen local dañada");
}
async function checkBlocks(blocks: TheoryBlock[]) {
  for (const block of blocks) {
    if (block.src) await checkImage(block.src);
    await checkBlocks(block.children);
  }
}
for (const document of data.documents) {
  if (document.cover) await checkImage(document.cover);
  await checkBlocks(document.blocks);
}
process.stdout.write("Contenido e imágenes de teoría validados.\n");
