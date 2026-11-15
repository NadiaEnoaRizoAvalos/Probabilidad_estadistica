import { Client, LogLevel } from "@notionhq/client";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { blockTypes, safeLink, validateTheory } from "../src/types/theory.ts";
import type { RichText, TheoryBlock, TheoryData } from "../src/types/theory.ts";

type Raw = Record<string, unknown>;
type Stage = "configuración" | "fuente" | "propiedad Estado" | "consulta de páginas" | "bloques" | "imágenes" | "validación" | "archivos locales";
export const notionVersion = "2026-03-11";
const reasons = {
  TOKEN_MISSING: "Falta el secreto NOTION_TOKEN en GitHub Actions. Configuralo en Secrets, con acceso a este repositorio.",
  SOURCE_MISSING: "Falta la variable NOTION_THEORY_SOURCE_ID en GitHub Actions. Configurala en Variables, no en Secrets.",
  SOURCE_ID_INVALID: "NOTION_THEORY_SOURCE_ID debe ser el ID de una data source o base de datos: 32 caracteres hexadecimales, con o sin guiones. No uses una URL ni el ID de una vista o página.",
  SOURCE_AMBIGUOUS: "El ID corresponde a una base contenedora, pero no contiene exactamente una data source. No se elegirá una fuente automáticamente. En la base original, abrí Administrar fuentes de datos (Manage data sources), elegí la fuente de tus unidades y usá Copiar ID de fuente de datos (Copy data source ID) para configurar NOTION_THEORY_SOURCE_ID.",
  STATE_MISSING: "No existe la propiedad Estado en la fuente autorizada. Revisá el nombre exacto y que el ID apunte a la base correcta.",
  STATE_TYPE: "La propiedad Estado debe ser de tipo Status o Select; el tipo actual es incompatible.",
  STATE_INCOMPLETE: "La API devolvió una propiedad Estado incompleta o incompatible; no se exportaron páginas.",
  PUBLICATION_OPTION_MISSING: "Estado no contiene una opción cuyo nombre sea publicado (sin distinguir mayúsculas). Revisá las opciones y que la fuente sea la de tus resúmenes.",
  PUBLICATION_OPTION_AMBIGUOUS: "Estado contiene varias opciones equivalentes a publicado al ignorar mayúsculas. Dejá una única opción de publicación para evitar ambigüedades.",
  ZERO_SOURCE_EMPTY: "La consulta sin filtro tampoco encontró páginas visibles en esta fuente. Verificá NOTION_THEORY_SOURCE_ID y la conexión con la base original de tus resúmenes.",
  ZERO_FILTER_MISMATCH: "El filtro no produjo documentos, pero la revisión de Estado encontró páginas publicadas. Se canceló la sincronización para evitar una exportación incompleta; volvé a ejecutar.",
  ZERO_NOT_CONFIRMED: "No hay páginas con la opción de publicación en la fuente consultada. Verificá que NOTION_THEORY_SOURCE_ID corresponda a tus resúmenes y que sus páginas tengan realmente ese Estado. No se pudo confirmar la retirada de todos los documentos previos.",
  PAGE_OUTSIDE_SOURCE: "Una página no pertenece a la fuente autorizada; se canceló la sincronización.",
  BLOCK_INCOMPLETE: "Un bloque o tabla está incompleto; no se publicará un documento parcial.",
  BLOCK_DEPTH: "Los bloques superan el límite de 100 niveles de anidamiento.",
  IMAGE_UNAVAILABLE: "La imagen no tiene un archivo o enlace externo disponible.",
  IMAGE_HTTPS: "Una imagen requiere una URL HTTPS válida, sin credenciales en la URL.",
  IMAGE_DOWNLOAD: "No se pudo descargar una imagen. Revisá el acceso, la caducidad del enlace y posibles redirecciones (no se siguen redirecciones).",
  IMAGE_SIZE: "Una imagen supera el límite de 10 MiB.",
  IMAGE_FORMAT: "Una imagen no es PNG, JPEG, GIF o WebP, o su firma no coincide con Content-Type.",
} as const;

class SyncFailure extends Error {
  stage: Stage;
  reason?: keyof typeof reasons;
  blockType?: string;
  counts?: { pages: number; published: number };
  sourceLookup?: "configured-id" | "database-child";
  constructor(stage: Stage, reason?: keyof typeof reasons, cause?: unknown) {
    super(reason ? reasons[reason] : "Falló la sincronización", { cause });
    this.stage = stage;
    this.reason = reason;
  }
}

async function atStage<T>(stage: Stage, work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) { throw error instanceof SyncFailure ? error : new SyncFailure(stage, undefined, error); }
}

// Only fixed messages and allowlisted metadata reach logs, never API messages, bodies or URLs.
export function diagnoseSyncError(error: unknown): string {
  const failure = error instanceof SyncFailure ? error : new SyncFailure("validación", undefined, error);
  let detail: string = failure.reason ? `[${failure.reason}] ${reasons[failure.reason]}` : "[INVALID_RESPONSE] Respuesta incompleta o inesperada. No se publicará contenido parcial.";
  let code: string | undefined, status: number | undefined;
  const knownCodes = ["unauthorized", "restricted_resource", "object_not_found", "validation_error", "invalid_json", "invalid_request", "invalid_request_url", "missing_version", "invalid_beta", "rate_limited", "conflict_error", "internal_server_error", "bad_gateway", "service_unavailable", "database_connection_unavailable", "gateway_timeout", "service_overload", "notionhq_client_request_timeout", "notionhq_client_response_error", "ENOTFOUND", "ECONNRESET", "ETIMEDOUT", "ECONNREFUSED"];
  let current: unknown = failure.cause;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    const raw = current as Raw;
    if (!code && typeof raw.code === "string" && knownCodes.includes(raw.code)) code = raw.code;
    if (status === undefined && typeof raw.status === "number" && Number.isInteger(raw.status) && raw.status >= 100 && raw.status <= 599) status = raw.status;
    current = raw.cause;
  }
  if (!failure.reason) {
    if (code === "unauthorized" || status === 401) detail = "[AUTHENTICATION] Notion rechazó la autenticación. Revisá que NOTION_TOKEN esté vigente y corresponda a la integración autorizada.";
    else if (code === "restricted_resource" || status === 403) detail = "[PERMISSIONS] Notion denegó el acceso. Revisá la conexión de la integración con la base, la capacidad de leer contenido y los límites del espacio de trabajo.";
    else if (code === "object_not_found" || status === 404) {
      detail = "[NOT_FOUND_OR_UNSHARED] El recurso no existe o no está compartido con la integración. Notion no distingue estos casos; un 404 no confirma que el ID sea incorrecto ni que la fuente haya sido eliminada.";
      if (failure.stage === "fuente") {
        if (failure.sourceLookup === "configured-id") detail += " El ID configurado no pudo leerse como fuente de datos ni como base contenedora.";
        if (failure.sourceLookup === "database-child") detail += " El ID configurado corresponde a una base contenedora accesible; se encontró una única fuente, pero falló su lectura.";
        detail += " Revisá en este orden: 1) En la base original, abrí Administrar fuentes de datos (Manage data sources), menú de la fuente de tus unidades, Copiar ID de fuente de datos (Copy data source ID). 2) Guardá ese ID en GitHub Actions > Variables > NOTION_THEORY_SOURCE_ID: no uses el nombre, una URL ni el ID de una vista o de una unidad. Un ID de base solo se resuelve si contiene una única fuente accesible. 3) En la base original, menú Conexiones > Agregar conexiones, autorizá la misma conexión cuyo token está en NOTION_TOKEN; verificá el espacio de trabajo y la capacidad Leer contenido (Read content). Si la galería es una vista enlazada, compartí la base original. 4) Si la fuente fue eliminada o reemplazada, copiá el ID de la fuente vigente y actualizá únicamente la variable. No publiques el token ni los IDs en los logs.";
      }
    }
    else if (code === "rate_limited" || status === 429) detail = "[API_RATE_LIMIT] Notion limitó las consultas tras los reintentos del SDK. Esperá y volvé a ejecutar.";
    else if (status !== undefined && status >= 500) detail = "[NOTION_API] Notion devolvió un error de servicio. Volvé a ejecutar más tarde.";
    else if (code === "notionhq_client_request_timeout" || code === "ETIMEDOUT") detail = "[API_TIMEOUT] La consulta a Notion agotó el tiempo de espera. Volvé a ejecutar.";
    else if (code && ["ENOTFOUND", "ECONNRESET", "ECONNREFUSED"].includes(code)) detail = "[API_CONNECTION] Falló la conexión con Notion. Volvé a ejecutar y revisá su disponibilidad.";
    else if (code || status !== undefined) detail = `[NOTION_API] Notion rechazó la consulta. Revisá la fuente, su esquema y la compatibilidad con la API ${notionVersion}.`;
    else if (failure.stage === "bloques") detail = "[BLOCK_INVALID] No se pudieron leer o convertir los bloques completos de una página.";
    else if (failure.stage === "imágenes") detail = "[IMAGE_DOWNLOAD] Falló la lectura de una imagen; revisá acceso, formato, tamaño y vigencia del enlace.";
    else if (failure.stage === "archivos locales") detail = "[LOCAL_FILES] No se pudieron escribir o retirar los archivos locales. No publiques los cambios de esta ejecución.";
  }
  if (failure.blockType) detail = `[BLOCK_UNSUPPORTED] Bloque no compatible: ${failure.blockType}. Adaptá ese bloque antes de reintentar; no se publicará un documento parcial.`;
  const metadata = [code ? `código=${code}` : "", status ? `HTTP=${status}` : ""].filter(Boolean).join("; ");
  const counts = failure.counts ? ` Revisión de la misma fuente: ${failure.counts.pages} páginas visibles; ${failure.counts.published} con la opción de publicación.` : "";
  return `Sincronización cancelada. Etapa: ${failure.stage}. ${detail}${metadata ? ` (${metadata})` : ""}${counts} ${failure.stage === "archivos locales" ? "No se publicarán cambios de esta ejecución." : "El contenido previo se conserva."}`;
}

const obj = (v: unknown): Raw => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Respuesta incompleta de Notion");
  return v as Raw;
};
const str = (v: unknown): string => {
  if (typeof v !== "string") throw new Error("Texto incompleto de Notion");
  return v;
};
const list = (v: unknown): unknown[] => {
  if (!Array.isArray(v)) throw new Error("Lista incompleta de Notion");
  return v;
};
const uuid = (v: string) => {
  const id = v.replaceAll("-", "").toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error("ID de Notion inválido");
  return id;
};
function rich(value: unknown): RichText[] {
  return list(value).map(item => {
    const r = obj(item), a = obj(r.annotations);
    const href = r.href == null ? undefined : str(r.href);
    return { text: r.type === "equation" ? str(obj(r.equation).expression) : str(r.plain_text), ...(r.type === "equation" ? { equation: true } : {}), ...(href && safeLink(href) ? { href } : {}), bold: a.bold === true, italic: a.italic === true, strike: a.strikethrough === true, underline: a.underline === true, code: a.code === true };
  });
}
async function paginate(request: (cursor?: string) => Promise<unknown>) {
  const results: unknown[] = [], seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = obj(await request(cursor));
    results.push(...list(page.results));
    if (typeof page.has_more !== "boolean") throw new Error("Paginación incompleta");
    if (!page.has_more) break;
    cursor = str(page.next_cursor);
    if (!cursor || seen.has(cursor)) throw new Error("Cursor inválido");
    seen.add(cursor);
  } while (cursor);
  return results;
}

// Only raster formats with matching signatures are published; SVG can execute content.
export async function downloadImage(url: string, fetcher: typeof fetch = fetch): Promise<{ bytes: Buffer; extension: string }> {
  return atStage("imágenes", async () => {
    let address: URL;
    try { address = new URL(url); } catch { throw new SyncFailure("imágenes", "IMAGE_HTTPS"); }
    if (address.protocol !== "https:" || address.username || address.password) throw new SyncFailure("imágenes", "IMAGE_HTTPS");
    const response = await fetcher(address, { signal: AbortSignal.timeout(30_000), redirect: "error" });
    if (!response.ok || !response.body) throw new SyncFailure("imágenes", "IMAGE_DOWNLOAD", { status: response.status });
    const limit = 10 * 1024 * 1024;
    if (Number(response.headers.get("content-length")) > limit) throw new SyncFailure("imágenes", "IMAGE_SIZE");
    const chunks: Uint8Array[] = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > limit) { await response.body.cancel().catch(() => { }); throw new SyncFailure("imágenes", "IMAGE_SIZE"); }
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    const extension = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "png"
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "jpg"
        : ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6)) ? "gif"
          : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" ? "webp" : "";
    const mime = response.headers.get("content-type")?.split(";")[0];
    if (!extension || mime !== ({ png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp" }[extension])) throw new SyncFailure("imágenes", "IMAGE_FORMAT");
    return { bytes, extension };
  });
}

export async function collectTheory(notion: Client, sourceId: string, fetcher: typeof fetch = fetch) {
  if (!/^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(sourceId)) throw new SyncFailure("fuente", "SOURCE_ID_INVALID");
  sourceId = uuid(sourceId).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
  const source = await atStage("fuente", async () => {
    let source: Raw;
    try { source = obj(await notion.dataSources.retrieve({ data_source_id: sourceId })); }
    catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "object_not_found") throw error;
      // Only inspect the configured ID; never search other libraries by title.
      let database: Raw;
      try { database = obj(await notion.databases.retrieve({ database_id: sourceId })); }
      catch (cause) {
        const failure = new SyncFailure("fuente", undefined, cause);
        failure.sourceLookup = "configured-id";
        throw failure;
      }
      const sources = list(database.data_sources);
      if (sources.length !== 1) throw new SyncFailure("fuente", "SOURCE_AMBIGUOUS");
      sourceId = str(obj(sources[0]).id);
      try { source = obj(await notion.dataSources.retrieve({ data_source_id: sourceId })); }
      catch (cause) {
        const failure = new SyncFailure("fuente", undefined, cause);
        failure.sourceLookup = "database-child";
        throw failure;
      }
    }
    return source;
  });
  const { schema, stateId, stateType, publishedName } = await atStage("propiedad Estado", async () => {
    const schema: (Raw & { name: string })[] = Object.entries(obj(source.properties)).map(([name, value]) => ({ name, ...obj(value) }));
    const state = schema.find(p => p.name === "Estado");
    if (!state) throw new SyncFailure("propiedad Estado", "STATE_MISSING");
    if (state.type !== "status" && state.type !== "select") throw new SyncFailure("propiedad Estado", "STATE_TYPE");
    const stateId = str(state.id), stateType = state.type;
    const options = list(obj(state[stateType]).options).map(obj);
    const matches = options.filter(option => str(option.name).toLocaleLowerCase("es") === "publicado");
    if (!matches.length) throw new SyncFailure("propiedad Estado", "PUBLICATION_OPTION_MISSING");
    if (matches.length !== 1) throw new SyncFailure("propiedad Estado", "PUBLICATION_OPTION_AMBIGUOUS");
    return { schema, stateId, stateType, publishedName: str(matches[0].name) };
  });
  const pages = await atStage("consulta de páginas", () => paginate(cursor => notion.dataSources.query({ data_source_id: sourceId, page_size: 100, start_cursor: cursor, filter: stateType === "status" ? { property: stateId, status: { equals: publishedName } } : { property: stateId, select: { equals: publishedName } }, sorts: [{ timestamp: "created_time", direction: "ascending" }] })));
  function pageStatus(page: Raw) {
    if (obj(page.parent).data_source_id !== sourceId) throw new SyncFailure("fuente", "PAGE_OUTSIDE_SOURCE");
    const status = Object.values(obj(page.properties)).map(obj).find(p => p.id === stateId);
    if (!status || status.type !== stateType) throw new SyncFailure("propiedad Estado", "STATE_INCOMPLETE");
    return status[stateType] === null ? null : str(obj(status[stateType]).name);
  }
  const assets = new Map<string, Buffer>();
  async function image(value: unknown) {
    return atStage("imágenes", async () => {
      const media = obj(value), type = str(media.type);
      if (type !== "file" && type !== "external") throw new SyncFailure("imágenes", "IMAGE_UNAVAILABLE");
      const { bytes, extension } = await downloadImage(str(obj(media[type]).url), fetcher);
      const name = `${createHash("sha256").update(bytes).digest("hex")}.${extension}`;
      assets.set(name, bytes);
      return `notion-images/${name}`;
    });
  }
  async function blocks(id: string, depth = 0): Promise<TheoryBlock[]> {
    return atStage("bloques", async () => {
      if (depth > 100) throw new SyncFailure("bloques", "BLOCK_DEPTH");
      const rows = await paginate(cursor => notion.blocks.children.list({ block_id: id, page_size: 100, start_cursor: cursor }));
      const output: TheoryBlock[] = [];
      for (const row of rows) {
        const b = obj(row), type = str(b.type), blockId = str(b.id);
        // Never traverse linked pages or synced blocks: they may expose unpublished material.
        if (!blockTypes.includes(type as TheoryBlock["type"])) {
          const error = new SyncFailure("bloques");
          error.blockType = ["child_page", "child_database", "synced_block", "bookmark", "embed", "link_preview", "link_to_page", "table_of_contents", "video", "audio", "pdf", "file", "unsupported", "breadcrumb", "transcription"].includes(type) ? type : "no reconocido";
          error.message = `Bloque no compatible: ${error.blockType}`;
          throw error;
        }
        const p = obj(b[type]);
        if (typeof b.has_children !== "boolean") throw new SyncFailure("bloques", "BLOCK_INCOMPLETE");
        if (["paragraph", "heading_1", "heading_2", "heading_3", "bulleted_list_item", "numbered_list_item", "to_do", "toggle", "quote", "callout", "code"].includes(type) && !Array.isArray(p.rich_text)) throw new SyncFailure("bloques", "BLOCK_INCOMPLETE");
        const block: TheoryBlock = { id: blockId, type: type as TheoryBlock["type"], text: rich(p.rich_text ?? p.caption ?? []), children: b.has_children === true ? await blocks(blockId, depth + 1) : [] };
        if (type === "image") block.src = await image(p);
        if (type === "equation") block.text = [{ text: str(p.expression), bold: false, italic: false, strike: false, underline: false, code: false }];
        if (type === "table_row") block.cells = list(p.cells).map(rich);
        if (type === "table") { block.columnHeader = p.has_column_header === true; block.rowHeader = p.has_row_header === true; }
        if (type === "table" && block.children.some(child => child.type !== "table_row")) throw new SyncFailure("bloques", "BLOCK_INCOMPLETE");
        if (type === "to_do") block.checked = p.checked === true;
        output.push(block);
      }
      return output;
    });
  }
  return atStage("validación", async () => {
    const data: TheoryData = { version: 1, documents: [] };
    for (const item of pages) {
      const page = obj(item), properties = Object.values(obj(page.properties)).map(obj);
      if (pageStatus(page) !== publishedName || page.in_trash === true || page.archived === true) continue;
      const title = properties.find(p => p.type === "title");
      if (!title) throw new Error("Página sin propiedad de título");
      const categorySchema = schema.find(p => ["categoría", "categoria"].includes(p.name.toLocaleLowerCase("es")));
      const category = properties.find(p => p.id === categorySchema?.id);
      let categoryText = "General";
      if (category?.type === "select" && category.select) categoryText = str(obj(category.select).name);
      if (category?.type === "multi_select") categoryText = list(category.multi_select).map(v => str(obj(v).name)).join(", ") || "General";
      if (category?.type === "rich_text") categoryText = rich(category.rich_text).map(r => r.text).join("") || "General";
      data.documents.push({ id: `notion-${uuid(str(page.id))}`, title: rich(title.title).map(r => r.text).join(""), category: categoryText, ...(page.cover ? { cover: await image(page.cover) } : {}), blocks: await blocks(str(page.id)) });
    }
    data.documents.sort((a, b) => a.id.localeCompare(b.id));
    validateTheory(data);
    let emptyCheck: { pages: number; published: number; withdrawnIds: Set<string> } | undefined;
    if (!data.documents.length) {
      emptyCheck = await atStage("consulta de páginas", async () => {
        // Inspect only Estado in this authorized source; never read draft blocks or assets.
        const visible = await paginate(cursor => notion.dataSources.query({ data_source_id: sourceId, page_size: 100, start_cursor: cursor, filter_properties: [stateId] }));
        const check = { pages: visible.length, published: 0, withdrawnIds: new Set<string>() };
        for (const item of visible) {
          const page = obj(item), status = pageStatus(page);
          if (status === publishedName && page.in_trash !== true && page.archived !== true) check.published++;
          else check.withdrawnIds.add(`notion-${uuid(str(page.id))}`);
        }
        if (!check.pages || check.published) {
          const error = new SyncFailure("consulta de páginas", check.published ? "ZERO_FILTER_MISMATCH" : "ZERO_SOURCE_EMPTY");
          error.counts = check;
          throw error;
        }
        return check;
      });
    }
    return { data, assets, emptyCheck };
  });
}

export async function syncTheory(notion: Client, sourceId: string, root = process.cwd(), fetcher: typeof fetch = fetch) {
  // Complete all reads and validation before touching the published snapshot.
  const { data, assets, emptyCheck } = await collectTheory(notion, sourceId, fetcher);
  return atStage("archivos locales", async () => {
    const file = resolve(root, "public/notion-theory.json"), directory = resolve(root, "public/notion-images");
    const json = JSON.stringify(data, null, 2) + "\n";
    let previous = "";
    try { previous = await readFile(file, "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    if (emptyCheck) {
      const prior: unknown = previous ? JSON.parse(previous) : { version: 1, documents: [] };
      validateTheory(prior);
      if (!prior.documents.length || !prior.documents.every(document => emptyCheck.withdrawnIds.has(document.id))) {
        const error = new SyncFailure("consulta de páginas", "ZERO_NOT_CONFIRMED");
        error.counts = emptyCheck;
        throw error;
      }
    }
    await mkdir(directory, { recursive: true });
    for (const [name, bytes] of assets) {
      const path = join(directory, name);
      try { if ((await readFile(path)).equals(bytes)) continue; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      await writeFile(`${path}.tmp`, bytes); await rename(`${path}.tmp`, path);
    }
    if (json !== previous) {
      await writeFile(`${file}.tmp`, json);
      await rename(`${file}.tmp`, file);
    }
    let removed = false;
    // Once the new snapshot is complete, retire assets belonging only to withdrawn pages.
    for (const name of await readdir(directory)) {
      if (/^[a-f0-9]{64}\.(png|jpg|gif|webp)$/.test(name) && !assets.has(name)) {
        await unlink(join(directory, name));
        removed = true;
      }
    }
    return { changed: json !== previous || removed, published: data.documents.length, withdrawn: !!emptyCheck };
  });
}

export function checkConfiguration(token: string | undefined, source: string | undefined) {
  if (!token?.trim()) throw new SyncFailure("configuración", "TOKEN_MISSING");
  if (!source?.trim()) throw new SyncFailure("configuración", "SOURCE_MISSING");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const token = process.env.NOTION_TOKEN, source = process.env.NOTION_THEORY_SOURCE_ID;
    checkConfiguration(token, source);
    const result = await syncTheory(new Client({ auth: token, notionVersion, logLevel: LogLevel.ERROR, logger: () => { } }), source ?? "");
    const message = `Sincronización completada: ${result.published} páginas publicadas. ${result.changed ? "Teoría actualizada." : "Sin cambios."}${result.withdrawn ? " Se verificó que todos los documentos previos dejaron de estar publicados en la misma fuente." : ""}`;
    process.stdout.write(`${message}\n`);
    if (process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_STEP_SUMMARY) {
      try { await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Sincronización de Notion\n\n${message}\n`); }
      catch { process.stderr.write("No se pudo escribir el resumen de GitHub Actions; el resultado está en el registro del paso.\n"); }
    }
  } catch (error) {
    // SDK errors may contain request URLs; never log raw responses or credentials.
    const diagnostic = diagnoseSyncError(error);
    process.stderr.write(process.env.GITHUB_ACTIONS === "true" ? `::error title=Sincronización de Notion::${diagnostic}\n` : `${diagnostic}\n`);
    if (process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_STEP_SUMMARY) {
      try { await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Sincronización de Notion cancelada\n\n${diagnostic}\n`); }
      catch { process.stderr.write("No se pudo escribir el resumen de GitHub Actions; el diagnóstico está en el registro del paso.\n"); }
    }
    process.exitCode = 1;
  }
}
