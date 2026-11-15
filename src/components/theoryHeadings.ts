import type { TheoryBlock } from "../types/theory";

export const headingAnchor = (blockId: string) => `notion-heading-${encodeURIComponent(blockId)}`;
export const normalizeSearch = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");

export function theoryHeadings(blocks: TheoryBlock[]): { id: string; title: string; level: number }[] {
  return blocks.flatMap(block => [
    ...(["heading_1", "heading_2", "heading_3"].includes(block.type)
      ? [{ id: headingAnchor(block.id), title: block.text.map(part => part.text).join(""), level: Number(block.type.slice(-1)) }]
      : []),
    ...theoryHeadings(block.children),
  ]);
}
