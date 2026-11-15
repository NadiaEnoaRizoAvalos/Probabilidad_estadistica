import { expect, it } from "vitest";
import { headingAnchor, normalizeSearch, theoryHeadings } from "../src/components/theoryHeadings";
import type { TheoryBlock } from "../src/types/theory";

it("conserva orden, jerarquía e IDs de encabezados repetidos y anidados", () => {
  const block = (id: string, type: TheoryBlock["type"], children: TheoryBlock[] = []): TheoryBlock => ({ id, type, text: [{ text: "Estadística", bold: false, italic: false, strike: false, underline: false, code: false }], children });
  const result = theoryHeadings([block("uno", "heading_1"), block("lista", "bulleted_list_item", [block("dos", "heading_2", [block("tres", "heading_3")])])]);
  expect(result).toEqual([
    { id: headingAnchor("uno"), title: "Estadística", level: 1 },
    { id: headingAnchor("dos"), title: "Estadística", level: 2 },
    { id: headingAnchor("tres"), title: "Estadística", level: 3 },
  ]);
  expect(normalizeSearch("PROBABILIDAD y ESTADÍSTICA")).toBe("probabilidad y estadistica");
  expect(theoryHeadings([])).toEqual([]);
});
