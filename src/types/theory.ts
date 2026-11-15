export interface RichText {
  text: string;
  href?: string;
  equation?: boolean;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  underline: boolean;
  code: boolean;
}

export const blockTypes = ["paragraph", "heading_1", "heading_2", "heading_3", "bulleted_list_item", "numbered_list_item", "to_do", "toggle", "quote", "callout", "code", "equation", "divider", "image", "table", "table_row", "column_list", "column"] as const;
export interface TheoryBlock {
  id: string;
  type: typeof blockTypes[number];
  text: RichText[];
  children: TheoryBlock[];
  cells?: RichText[][];
  src?: string;
  checked?: boolean;
  columnHeader?: boolean;
  rowHeader?: boolean;
}
export interface TheoryDocument {
  id: string;
  title: string;
  category: string;
  cover?: string;
  blocks: TheoryBlock[];
}
export interface TheoryData { version: 1; documents: TheoryDocument[] }

export function safeLink(value: string): boolean {
  try { return ["https:", "http:", "mailto:"].includes(new URL(value).protocol); }
  catch { return false; }
}
export const localImage = (value: string) => /^notion-images\/[a-f0-9]{64}\.(png|jpg|gif|webp)$/.test(value);

export function validateTheory(value: unknown): asserts value is TheoryData {
  const fail = () => { throw new Error("Contenido de teoría inválido"); };
  const object = (v: unknown): Record<string, unknown> => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return fail();
    return v as Record<string, unknown>;
  };
  const string = (v: unknown) => { if (typeof v !== "string") fail(); };
  const rich = (v: unknown) => {
    if (!Array.isArray(v)) return fail();
    for (const item of v) {
      const r = object(item); string(r.text);
      for (const flag of ["bold", "italic", "strike", "underline", "code"]) if (typeof r[flag] !== "boolean") fail();
      if (r.equation !== undefined && typeof r.equation !== "boolean") fail();
      if (r.href !== undefined && (typeof r.href !== "string" || !safeLink(r.href))) fail();
    }
  };
  const image = (v: unknown) => { if (typeof v !== "string" || !localImage(v)) fail(); };
  const blocks = (v: unknown, depth = 0) => {
    if (!Array.isArray(v) || depth > 100) return fail();
    const ids = new Set();
    for (const item of v) {
      const b = object(item); string(b.id);
      if (ids.has(b.id) || !blockTypes.includes(b.type as TheoryBlock["type"])) fail();
      ids.add(b.id); rich(b.text); blocks(b.children, depth + 1);
      if (b.type === "image") image(b.src);
      if (b.type === "table_row") {
        if (!Array.isArray(b.cells)) return fail();
        b.cells.forEach(rich);
      }
      for (const key of ["checked", "columnHeader", "rowHeader"]) if (b[key] !== undefined && typeof b[key] !== "boolean") fail();
    }
  };
  const root = object(value);
  if (root.version !== 1 || !Array.isArray(root.documents)) return fail();
  const ids = new Set();
  for (const item of root.documents) {
    const d = object(item);
    if (typeof d.id !== "string" || !/^notion-[a-f0-9]{32}$/.test(d.id) || ids.has(d.id)) fail();
    ids.add(d.id); string(d.title); string(d.category); blocks(d.blocks);
    if (d.cover !== undefined) image(d.cover);
  }
}

export function blockText(blocks: TheoryBlock[]): string {
  return blocks.map(b => [...b.text.map(r => r.text), ...(b.cells ?? []).flat().map(r => r.text), blockText(b.children)].join(" ")).join(" ");
}
