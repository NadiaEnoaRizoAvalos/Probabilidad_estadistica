import { describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "@notionhq/client";
import { checkConfiguration, collectTheory, diagnoseSyncError, downloadImage, notionVersion, syncTheory } from "../scripts/sync-notion";
import { blockText, validateTheory } from "../src/types/theory";
import { parseStudyState } from "../src/hooks/studyStorage";

const sourceId = "11111111-1111-1111-1111-111111111111";
const pageId = "22222222-2222-2222-2222-222222222222";
const rich = (text: string) => [{ plain_text: text, annotations: { bold: true, italic: true }, href: "https://example.org" }];
const page = (status = "Publicado", type = "status", id = pageId) => ({ object: "page", id, parent: { data_source_id: sourceId }, properties: { internal: { id: "s%3A", type, [type]: { name: status } }, title: { id: "title", type: "title", title: rich("Apunte de prueba") } }, cover: null });
const batch = (results: unknown[], more = false) => ({
  results: results.map(value => {
    const row = value as Record<string, unknown>;
    return row.type ? { has_children: false, ...row } : row;
  }), has_more: more, next_cursor: more ? "next" : null
});
function mock(type = "status", publishedName = "Publicado") {
  return {
    dataSources: { retrieve: vi.fn().mockResolvedValue({ properties: { Estado: { id: "s%3A", type, [type]: { options: [{ id: "published-option", name: publishedName }, { id: "draft-option", name: "Borrador" }] } } } }), query: vi.fn().mockResolvedValue(batch([page(publishedName, type)])) },
    databases: { retrieve: vi.fn() },
    blocks: { children: { list: vi.fn().mockResolvedValue(batch([{ id: "block", type: "paragraph", has_children: false, paragraph: { rich_text: rich("Texto académico intacto") } }])) } },
  };
}
const client = (value: ReturnType<typeof mock>) => value as unknown as Client;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const fetchImage = vi.fn<typeof fetch>(async () => new Response(png, { headers: { "content-type": "image/png" } }));

describe("Sincronización de Notion", () => {
  it.each([
    ["status", "publicado"], ["select", "publicado"],
    ["status", "Publicado"], ["select", "PUBLICADO"],
    ["status", "PuBlIcAdO"], ["select", "PuBlIcAdO"],
  ])("resuelve la opción real %s/%s y exporta los dos resúmenes", async (type, name) => {
    const m = mock(type, name);
    m.dataSources.query.mockResolvedValue(batch([page(name, type), page(name, type, "33333333-3333-3333-3333-333333333333"), page("Borrador", type, "44444444-4444-4444-4444-444444444444")]));
    const { data } = await collectTheory(client(m), sourceId);
    expect(data.documents).toHaveLength(2);
    expect(m.dataSources.query).toHaveBeenCalledWith(expect.objectContaining({ filter: { property: "s%3A", [type]: { equals: name } } }));
    expect(m.blocks.children.list).toHaveBeenCalledTimes(2);
  });
  it.each([[], ["Borrador"], ["Publicado", "publicado"]])("rechaza opciones ausentes o ambiguas sin consultar páginas", async (...names) => {
    const m = mock();
    m.dataSources.retrieve.mockResolvedValue({ properties: { Estado: { id: "s%3A", type: "status", status: { options: names.map(name => ({ name })) } } } });
    try { await collectTheory(client(m), sourceId); throw new Error("Se esperaba un error"); }
    catch (error) { expect(diagnoseSyncError(error)).toMatch(/PUBLICATION_OPTION_(MISSING|AMBIGUOUS)/); }
    expect(m.dataSources.query).not.toHaveBeenCalled();
  });
  it.each(["status", "select"])("usa el ID interno de Estado %s y excluye borradores", async type => {
    const m = mock(type);
    m.dataSources.query.mockResolvedValue(batch([page("Publicado", type), page("Borrador", type, "33333333-3333-3333-3333-333333333333")]));
    const { data } = await collectTheory(client(m), sourceId);
    expect(data.documents).toHaveLength(1);
    expect(m.dataSources.query).toHaveBeenCalledWith(expect.objectContaining({ filter: { property: "s%3A", [type]: { equals: "Publicado" } } }));
    expect(data.documents[0].category).toBe("General");
    expect(blockText(data.documents[0].blocks)).toContain("Texto académico intacto");
    expect(data.documents[0].blocks[0].text[0]).toMatchObject({ bold: true, italic: true });
    expect(m.blocks.children.list).toHaveBeenCalledTimes(1);
  });
  it("resuelve una base con una única data source", async () => {
    const m = mock();
    const databaseId = "33333333-3333-3333-3333-333333333333";
    m.dataSources.retrieve.mockRejectedValueOnce({ code: "object_not_found" });
    m.databases.retrieve.mockResolvedValue({ data_sources: [{ id: sourceId }] });
    await collectTheory(client(m), databaseId);
    expect(m.dataSources.retrieve.mock.calls.map(([args]) => args.data_source_id)).toEqual([databaseId, sourceId]);
    expect(m.databases.retrieve).toHaveBeenCalledWith({ database_id: databaseId });
    expect(m.dataSources.query).toHaveBeenCalledWith(expect.objectContaining({ data_source_id: sourceId }));
  });
  it.each([false, true])("usa el SDK real con endpoints de lectura y versión explícita (base contenedora: %s)", async fromDatabase => {
    const databaseId = "33333333-3333-3333-3333-333333333333";
    const schema = await mock().dataSources.retrieve();
    const published = page("PuBlIcAdO"), draft = page("Borrador", "status", "44444444-4444-4444-4444-444444444444");
    const originalPages = structuredClone([published, draft]);
    schema.properties.Estado.status.options[0].name = "PuBlIcAdO";
    const requests: { method: string; path: string; version: string | null; body?: unknown }[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      const request = new Request(input, init), path = new URL(request.url).pathname;
      const body = request.method === "POST" ? await request.json() : undefined;
      requests.push({ method: request.method, path, version: request.headers.get("Notion-Version"), body });
      if (path === `/v1/data_sources/${databaseId}`)
        return Response.json({ object: "error", status: 404, code: "object_not_found", message: "Fixture" }, { status: 404 });
      if (path === `/v1/databases/${databaseId}`) return Response.json({ data_sources: [{ id: sourceId }] });
      if (path === `/v1/data_sources/${sourceId}`) return Response.json(schema);
      if (path === `/v1/data_sources/${sourceId}/query`) return Response.json(batch([published, draft]));
      if (path === `/v1/blocks/${pageId}/children`) return Response.json(batch([]));
      throw new Error("El script intentó un endpoint no autorizado por la prueba");
    };
    const notion = new Client({ auth: "synthetic-test-token", notionVersion, fetch: fetcher, logger: () => {} });
    const { data } = await collectTheory(notion, fromDatabase ? databaseId : sourceId);
    expect(data.documents).toHaveLength(1);
    expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      ...(fromDatabase ? [`GET /v1/data_sources/${databaseId}`, `GET /v1/databases/${databaseId}`] : []),
      `GET /v1/data_sources/${sourceId}`,
      `POST /v1/data_sources/${sourceId}/query`,
      `GET /v1/blocks/${pageId}/children`,
    ]);
    expect(requests.every(request => request.version === "2026-03-11")).toBe(true);
    expect(requests.find(request => request.method === "POST")?.body).toMatchObject({ filter: { property: "s%3A", status: { equals: "PuBlIcAdO" } } });
    expect([published, draft]).toEqual(originalPages);
  });
  it("pagina páginas y bloques anidados en orden", async () => {
    const m = mock();
    m.dataSources.query.mockResolvedValueOnce(batch([page()], true)).mockResolvedValueOnce(batch([]));
    m.blocks.children.list.mockResolvedValueOnce(batch([{ id: "parent", type: "bulleted_list_item", has_children: true, bulleted_list_item: { rich_text: rich("Primero") } }], true)).mockResolvedValueOnce(batch([{ id: "tail", type: "paragraph", paragraph: { rich_text: rich("Segundo") } }])).mockResolvedValueOnce(batch([{ id: "child", type: "heading_2", heading_2: { rich_text: rich("Anidado") } }]));
    const { data } = await collectTheory(client(m), sourceId);
    expect(m.dataSources.query.mock.calls[1][0].start_cursor).toBe("next");
    expect(data.documents[0].blocks.map(b => b.id)).toEqual(["parent", "tail"]);
    expect(data.documents[0].blocks[0].children[0].text[0].text).toBe("Anidado");
  });
  it("conserva fórmulas inline y de bloque para el renderizado matemático", async () => {
    const m = mock();
    m.blocks.children.list.mockResolvedValue(batch([
      { id: "inline", type: "paragraph", paragraph: { rich_text: [{ type: "equation", plain_text: "x^2", equation: { expression: "x^2" }, annotations: {}, href: null }] } },
      { id: "formula", type: "equation", equation: { expression: "\\frac{1}{3}" } },
    ]));
    const { data } = await collectTheory(client(m), sourceId);
    expect(data.documents[0].blocks[0].text[0]).toMatchObject({ equation: true, text: "x^2" });
    expect(data.documents[0].blocks[1].text[0].text).toBe("\\frac{1}{3}");
    expect(() => validateTheory(data)).not.toThrow();
  });
  it("copia portada e imágenes con nombres estables y conserva tablas", async () => {
    const m = mock(), p = { ...page(), cover: { type: "file", file: { url: "https://example.org/cover?signature=private" } } };
    m.dataSources.query.mockResolvedValue(batch([p]));
    m.blocks.children.list.mockResolvedValueOnce(batch([{ id: "img", type: "image", image: { type: "external", external: { url: "https://example.org/picture" }, caption: rich("Figura") } }, { id: "table", type: "table", has_children: true, table: { has_column_header: true } }])).mockResolvedValueOnce(batch([{ id: "row", type: "table_row", table_row: { cells: [rich("Dato")] } }]));
    const { data, assets } = await collectTheory(client(m), sourceId, fetchImage);
    expect(assets.size).toBe(1);
    expect(data.documents[0].cover).toBe(data.documents[0].blocks[0].src);
    expect(JSON.stringify(data)).not.toContain("signature");
    expect(data.documents[0].blocks[1].children[0].cells?.[0][0].text).toBe("Dato");
  });
  it("acepta documentos sin bloques, pero investiga una fuente sin páginas", async () => {
    const m = mock(); m.blocks.children.list.mockResolvedValue(batch([]));
    expect((await collectTheory(client(m), sourceId)).data.documents[0].blocks).toEqual([]);
    m.dataSources.query.mockResolvedValue(batch([]));
    await expect(collectTheory(client(m), sourceId)).rejects.toThrow("tampoco encontró páginas");
    expect(m.dataSources.query).toHaveBeenLastCalledWith(expect.objectContaining({ data_source_id: sourceId, filter_properties: ["s%3A"] }));
  });
  it("rechaza esquemas inválidos, páginas ajenas, cursores incompletos y bloques no soportados", async () => {
    const m = mock();
    m.dataSources.retrieve.mockResolvedValueOnce({ properties: { Estado: { type: "checkbox" } } });
    await expect(collectTheory(client(m), sourceId)).rejects.toThrow();
    m.dataSources.query.mockResolvedValueOnce(batch([{ ...page(), parent: { data_source_id: "other" } }]));
    await expect(collectTheory(client(m), sourceId)).rejects.toThrow();
    m.dataSources.query.mockResolvedValueOnce({ results: [], has_more: true, next_cursor: null });
    await expect(collectTheory(client(m), sourceId)).rejects.toThrow();
    m.blocks.children.list.mockResolvedValueOnce(batch([{ id: "private", type: "child_page", has_children: true, child_page: { title: "Privado" } }]));
    await expect(collectTheory(client(m), sourceId)).rejects.toThrow("child_page");
    m.blocks.children.list.mockResolvedValueOnce(batch([{ id: "partial", type: "paragraph", paragraph: {} }]));
    await expect(collectTheory(client(m), sourceId)).rejects.toThrow("incompleto");
  });
  it("no cambia archivos idénticos, preserva el snapshot ante errores y retira borradores tras éxito", async () => {
    const root = await mkdtemp(join(tmpdir(), "notion-test-"));
    try {
      const m = mock(), file = join(root, "public/notion-theory.json");
      await mkdir(join(root, "public"), { recursive: true });
      await writeFile(file, "anterior");
      m.dataSources.query.mockRejectedValueOnce(new Error("conexión"));
      await expect(syncTheory(client(m), sourceId, root)).rejects.toThrow();
      expect(await readFile(file, "utf8")).toBe("anterior");
      expect(await syncTheory(client(m), sourceId, root)).toMatchObject({ changed: true, published: 1 });
      const previous = await readFile(file, "utf8"), time = (await stat(file)).mtimeMs;
      expect(await syncTheory(client(m), sourceId, root)).toMatchObject({ changed: false, published: 1 });
      expect((await stat(file)).mtimeMs).toBe(time);
      m.blocks.children.list.mockRejectedValueOnce(new Error("bloques"));
      await expect(syncTheory(client(m), sourceId, root)).rejects.toThrow();
      expect(await readFile(file, "utf8")).toBe(previous);
      m.blocks.children.list.mockResolvedValueOnce(batch([{ id: "img", type: "image", image: { type: "file", file: { url: "https://example.org/image" } } }]));
      await expect(syncTheory(client(m), sourceId, root, async () => { throw new Error("descarga"); })).rejects.toThrow();
      expect(await readFile(file, "utf8")).toBe(previous);
      const stale = join(root, "public/notion-images", `${"a".repeat(64)}.png`);
      await writeFile(stale, png);
      m.dataSources.query.mockResolvedValue(batch([page("Borrador")]));
      await syncTheory(client(m), sourceId, root);
      expect(JSON.parse(await readFile(file, "utf8")).documents).toEqual([]);
      await expect(readFile(stale)).rejects.toMatchObject({ code: "ENOENT" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("investiga cero resultados con paginación, preserva datos ante una fuente equivocada y cuenta las publicaciones", async () => {
    const root = await mkdtemp(join(tmpdir(), "notion-zero-test-"));
    try {
      const m = mock("status", "publicado"), file = join(root, "public/notion-theory.json");
      const secondId = "33333333-3333-3333-3333-333333333333";
      m.dataSources.query.mockResolvedValue(batch([page("publicado"), page("publicado", "status", secondId)]));
      expect(await syncTheory(client(m), sourceId, root)).toEqual({ changed: true, published: 2, withdrawn: false });
      expect(await syncTheory(client(m), sourceId, root)).toEqual({ changed: false, published: 2, withdrawn: false });
      const previous = await readFile(file, "utf8");
      m.blocks.children.list.mockClear();
      // A filtered query returning nothing is not proof that no published pages exist.
      m.dataSources.query.mockResolvedValueOnce(batch([])).mockResolvedValueOnce(batch([page("publicado")], true)).mockResolvedValueOnce(batch([page("publicado", "status", secondId)]));
      try { await syncTheory(client(m), sourceId, root); throw new Error("Se esperaba un error"); }
      catch (error) {
        const message = diagnoseSyncError(error);
        expect(message).toContain("[ZERO_FILTER_MISMATCH]");
        expect(message).toContain("2 páginas visibles; 2 con la opción de publicación");
        expect(message).not.toContain("Apunte de prueba");
        expect(message).not.toContain(sourceId);
      }
      expect(m.dataSources.query.mock.calls.at(-1)?.[0]).toMatchObject({ filter_properties: ["s%3A"], start_cursor: "next" });
      expect(await readFile(file, "utf8")).toBe(previous);
      // An unrelated set of drafts cannot authorize deleting the previous documents.
      m.dataSources.query.mockResolvedValueOnce(batch([])).mockResolvedValueOnce(batch([page("Borrador", "status", "44444444-4444-4444-4444-444444444444")]));
      await expect(syncTheory(client(m), sourceId, root)).rejects.toThrow("No se pudo confirmar");
      expect(await readFile(file, "utf8")).toBe(previous);
      // Only confirmation that both previous pages are now drafts permits an empty snapshot.
      m.dataSources.query.mockResolvedValueOnce(batch([])).mockResolvedValueOnce(batch([page("Borrador"), page("Borrador", "status", secondId)]));
      expect(await syncTheory(client(m), sourceId, root)).toEqual({ changed: true, published: 0, withdrawn: true });
      expect(m.blocks.children.list).not.toHaveBeenCalled();
      expect(JSON.parse(await readFile(file, "utf8")).documents).toEqual([]);
      m.dataSources.query.mockResolvedValueOnce(batch([])).mockResolvedValueOnce(batch([page("Borrador")]));
      await expect(syncTheory(client(m), sourceId, root)).rejects.toThrow("No se pudo confirmar");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("valida formatos, tamaño y HTTPS de imágenes", async () => {
    expect((await downloadImage("https://example.org/image", fetchImage)).extension).toBe("png");
    await expect(downloadImage("http://example.org/image", fetchImage)).rejects.toThrow();
    await expect(downloadImage("https://example.org/image", async () => new Response("<svg/>", { headers: { "content-type": "image/png" } }))).rejects.toThrow();
    await expect(downloadImage("https://example.org/image", async () => new Response(png, { headers: { "content-type": "image/png", "content-length": "20000000" } }))).rejects.toThrow();
    await expect(downloadImage("https://example.org/image", async () => new Response(png, { status: 403 }))).rejects.toThrow();
  });
  it("rechaza JSON inseguro y conserva progreso estable y previo aunque un documento se retire", () => {
    expect(() => validateTheory({ version: 1, documents: [{ id: "x" }] })).toThrow();
    const id = `notion-${pageId.replaceAll("-", "")}`, date = "2026-11-14T12:00:00Z";
    expect(parseStudyState(JSON.stringify({ completed: { [id]: date, retirada: date } })).completed).toEqual({ [id]: date });
  });
});

describe("Diagnóstico seguro de Notion", () => {
  const privateText = "PRIVATE_TOKEN PRIVATE_TITLE https://private.example/image?signature=PRIVATE_SIGNATURE\n::error::PRIVATE_INJECTION";
  const apiError = (code: string, status?: number) => ({ code, status, message: privateText, body: privateText, headers: { authorization: privateText }, request_id: privateText });
  async function diagnostic(work: () => Promise<unknown>) {
    try { await work(); throw new Error("Se esperaba un error"); }
    catch (error) {
      const result = diagnoseSyncError(error);
      expect(result).not.toContain("PRIVATE_");
      expect(result).not.toContain("https://");
      expect(result).not.toContain("\n");
      return result;
    }
  }
  it.each([
    ["unauthorized", 401, "AUTHENTICATION"],
    ["restricted_resource", 403, "PERMISSIONS"],
    ["object_not_found", 404, "NOT_FOUND_OR_UNSHARED"],
    ["validation_error", 400, "NOTION_API"],
    ["rate_limited", 429, "API_RATE_LIMIT"],
    ["internal_server_error", 500, "NOTION_API"],
    ["service_unavailable", 503, "NOTION_API"],
    ["notionhq_client_request_timeout", undefined, "API_TIMEOUT"],
    ["ECONNRESET", undefined, "API_CONNECTION"],
  ] as const)("clasifica %s sin exponer la respuesta", async (code, status, expected) => {
    const m = mock(); m.dataSources.retrieve.mockRejectedValue(apiError(code, status));
    m.databases.retrieve.mockRejectedValue(apiError(code, status));
    const result = await diagnostic(() => collectTheory(client(m), sourceId));
    expect(result).toContain(`[${expected}]`);
    expect(result).toContain("Etapa: fuente");
    expect(result).toContain(`código=${code}`);
    if (status) expect(result).toContain(`HTTP=${status}`);
    if (code === "object_not_found") expect(result).toContain("no distingue estos casos");
  });
  it("no confunde autenticación con el intento de resolver una base", async () => {
    const m = mock(); m.dataSources.retrieve.mockRejectedValue(apiError("unauthorized", 401));
    await diagnostic(() => collectTheory(client(m), sourceId));
    expect(m.databases.retrieve).not.toHaveBeenCalled();
  });
  it("explica el 404 de ambos tipos de recurso sin afirmar una causa ni imprimir IDs", async () => {
    const m = mock();
    const privateError = { ...apiError("object_not_found", 404), message: `${privateText} ${sourceId} ${pageId}` };
    m.dataSources.retrieve.mockRejectedValue(privateError);
    m.databases.retrieve.mockRejectedValue(privateError);
    const result = await diagnostic(() => collectTheory(client(m), sourceId));
    expect(result).toContain("no pudo leerse como fuente de datos ni como base contenedora");
    expect(result).toContain("un 404 no confirma");
    for (const hint of ["Copy data source ID", "NOTION_THEORY_SOURCE_ID", "Agregar conexiones", "Read content", "vista enlazada", "eliminada o reemplazada"])
      expect(result).toContain(hint);
    for (const id of [sourceId, pageId, sourceId.replaceAll("-", ""), pageId.replaceAll("-", "")])
      expect(result).not.toContain(id);
    expect(m.dataSources.query).not.toHaveBeenCalled();
    expect(m.blocks.children.list).not.toHaveBeenCalled();
  });
  it("distingue una base accesible cuya fuente hija no se puede leer", async () => {
    const m = mock(), databaseId = "33333333-3333-3333-3333-333333333333";
    m.dataSources.retrieve.mockRejectedValue(apiError("object_not_found", 404));
    m.databases.retrieve.mockResolvedValue({ data_sources: [{ id: sourceId }] });
    const result = await diagnostic(() => collectTheory(client(m), databaseId));
    expect(result).toContain("base contenedora accesible");
    expect(result).toContain("falló su lectura");
    expect(result).not.toContain("no pudo leerse como fuente de datos ni como base contenedora");
    expect(result).not.toContain(databaseId);
    expect(result).not.toContain(sourceId);
    expect(m.dataSources.query).not.toHaveBeenCalled();
  });
  it("detecta configuraciones ausentes, IDs inválidos y bases ambiguas", async () => {
    for (const token of [undefined, "", "  "]) {
      expect(await diagnostic(async () => checkConfiguration(token, sourceId))).toContain("[TOKEN_MISSING]");
    }
    expect(() => checkConfiguration("token", undefined)).toThrow("NOTION_THEORY_SOURCE_ID");
    const m = mock();
    expect(await diagnostic(() => collectTheory(client(m), privateText))).toContain("[SOURCE_ID_INVALID]");
    expect(m.dataSources.retrieve).not.toHaveBeenCalled();
    m.dataSources.retrieve.mockRejectedValueOnce(apiError("object_not_found", 404));
    m.databases.retrieve.mockResolvedValue({ data_sources: [{ id: sourceId }, { id: pageId }] });
    expect(await diagnostic(() => collectTheory(client(m), sourceId))).toContain("[SOURCE_AMBIGUOUS]");
  });
  it.each([[{}, "STATE_MISSING"], [{ Estado: { id: "s%3A", type: "checkbox" } }, "STATE_TYPE"]])("identifica problemas de Estado", async (properties, expected) => {
    const m = mock(); m.dataSources.retrieve.mockResolvedValue({ properties });
    const result = await diagnostic(() => collectTheory(client(m), sourceId));
    expect(result).toContain(`[${expected}]`);
    expect(result).toContain("Etapa: propiedad Estado");
    expect(m.dataSources.query).not.toHaveBeenCalled();
  });
  it("identifica la etapa de una API fallida y bloques incompatibles sin imprimir texto privado", async () => {
    const m = mock();
    m.dataSources.query.mockRejectedValueOnce(apiError("service_unavailable", 503));
    expect(await diagnostic(() => collectTheory(client(m), sourceId))).toContain("Etapa: consulta de páginas");
    m.blocks.children.list.mockRejectedValueOnce(apiError("restricted_resource", 403));
    const denied = await diagnostic(() => collectTheory(client(m), sourceId));
    expect(denied).toContain("Etapa: bloques"); expect(denied).toContain("[PERMISSIONS]");
    for (const type of ["synced_block", privateText]) {
      m.blocks.children.list.mockResolvedValueOnce(batch([{ id: privateText, type, [type]: {} }]));
      const result = await diagnostic(() => collectTheory(client(m), sourceId));
      expect(result).toContain("[BLOCK_UNSUPPORTED]");
      expect(result).toContain(type === "synced_block" ? "synced_block" : "no reconocido");
    }
  });
  it("distingue errores de imágenes y conserva sólo el código HTTP", async () => {
    const denied = await diagnostic(() => downloadImage("https://example.org/image", async () => new Response(privateText, { status: 403 })));
    expect(denied).toContain("[IMAGE_DOWNLOAD]"); expect(denied).toContain("HTTP=403"); expect(denied).not.toContain("[PERMISSIONS]");
    expect(await diagnostic(() => downloadImage("http://example.org/image", fetchImage))).toContain("[IMAGE_HTTPS]");
    expect(await diagnostic(() => downloadImage("https://example.org/image", async () => new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } })))).toContain("[IMAGE_FORMAT]");
    expect(await diagnostic(() => downloadImage("https://example.org/image", async () => new Response(png, { headers: { "content-length": "20000000" } })))).toContain("[IMAGE_SIZE]");
  });
  it("no imprime errores desconocidos, sus causas ni códigos arbitrarios", () => {
    for (const error of [null, privateText, new Error(privateText), apiError(privateText), new Error(privateText, { cause: apiError(privateText) })]) {
      const result = diagnoseSyncError(error);
      expect(result).not.toContain("PRIVATE_"); expect(result).not.toContain("\n");
    }
  });
  it("emite una anotación y un resumen seguros desde el CLI sin tocar el snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "notion-cli-test-"));
    try {
      const summary = join(root, "summary.txt"), file = join(root, "public/notion-theory.json");
      await mkdir(join(root, "public"));
      await writeFile(file, "contenido previo");
      const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/sync-notion.ts", import.meta.url))], {
        cwd: root, encoding: "utf8", env: { ...process.env, NOTION_TOKEN: privateText, NOTION_THEORY_SOURCE_ID: privateText, GITHUB_ACTIONS: "true", GITHUB_STEP_SUMMARY: summary },
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("::error title=Sincronización de Notion::");
      expect(result.stderr).toContain("[SOURCE_ID_INVALID]");
      expect(result.stdout + result.stderr + await readFile(summary, "utf8")).not.toContain("PRIVATE_");
      expect(await readFile(summary, "utf8")).toContain("El contenido previo se conserva");
      expect(await readFile(file, "utf8")).toBe("contenido previo");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
