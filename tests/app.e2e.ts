import { expect, test } from "@playwright/test";

// Empty-state checks remain valid after the real course material is synchronized.
test.beforeEach(async ({ page }) => {
  await page.route("**/notion-theory.json", route => route.fulfill({ json: { version: 1, documents: [] } }));
  await page.route("**/exams/catalog.json", route => route.fulfill({ json: { version: 1, exams: [], questions: [] } }));
});

test("navegación, progreso independiente, fecha y rutas desconocidas", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("gestion-calidad-estudio-v1", JSON.stringify({ examDate: "2026-12-31", completed: { mapa: "2026-11-15" } })));
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Tu progreso" })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByRole("button", { name: /Fecha del parcial/ })).toContainText("Configurar fecha");
  await page.getByRole("button", { name: /Fecha del parcial/ }).click();
  await page.getByLabel("Fecha del próximo parcial").fill("2026-12-15");
  await page.getByRole("button", { name: "Guardar fecha" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: /Fecha del parcial/ })).toContainText("15 de diciembre de 2026");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gestion-calidad-estudio-v1")!).examDate)).toBe("2026-12-31");
  const routes = [
    ["Teoría", "Tus resúmenes, en un solo lugar"],
    ["Laboratorio de Estadística", "Estadística descriptiva"],
    ["Parciales", "Tus parciales anteriores, en un solo lugar"],
    ["Apoyo inteligente", "Elegí tus temas"],
    ["Ruta de estudio", "0% de tu recorrido"],
  ];
  for (const [label, heading] of routes) {
    await page.getByRole("navigation").getByRole("link", { name: label, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await page.goto("./#/desconocida");
  await expect(page.getByRole("main")).toContainText(/no|encontr/i);
  expect(errors).toEqual([]);
});

for (const width of [320, 390, 768, 1440]) {
  test(`inicio centrado y sin desbordamiento a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const failures: string[] = [];
    page.on("response", response => { if (response.status() >= 400 && response.url().startsWith("http://127.0.0.1")) failures.push(response.url()); });
    await page.goto("./");
    await expect(page.locator(".module-card")).toHaveCount(4);
    await page.evaluate(() => Promise.all(Array.from(document.images, image => image.decode().catch(() => {}))));
    expect(await page.evaluate(() => Array.from(document.images).every(image => image.complete && image.naturalWidth > 0))).toBe(true);
    const heading = await page.locator(".brand").boundingBox();
    expect(Math.abs(heading!.x + heading!.width / 2 - width / 2)).toBeLessThan(3);
    const cards = await page.locator(".module-card").all();
    const boxes = await Promise.all(cards.map(card => card.boundingBox()));
    for (const box of boxes) {
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.height).toBeGreaterThanOrEqual(200);
      expect(Math.abs(box!.width - boxes[0]!.width)).toBeLessThan(1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(failures).toEqual([]);
    await page.screenshot({ path: `test-results/inicio-${width}.png`, fullPage: true });
    for (const route of ["teoria", "laboratorio", "parciales", "repaso", "ruta"]) {
      await page.goto(`./#/${route}`);
      await expect(page.getByRole("main")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

test("resultados numéricos con tolerancia en repaso y simulacro", async ({ page }) => {
  const question = { id: "fixture", examId: "fixture", topic: "fixture", prompt: "Prueba técnica $x$", type: "numeric", options: [], correct: null, verified: true, numericAnswer: { value: 1 / 3, absoluteTolerance: 0.001, relativeTolerance: 0.001 }, explanation: "Desarrollo $x=1/3$", steps: ["Paso $x$"], tags: [], origin: "Parcial anterior" };
  await page.route("**/exams/catalog.json", route => route.fulfill({ json: { version: 1, exams: [{ id: "fixture", title: "Fixture técnico", topic: "fixture", photos: [] }], questions: [question] } }));
  await page.goto("./#/repaso");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Practicar 1 pregunta" }).click();
  await expect(page.locator("h2 .katex")).toBeVisible();
  await page.getByLabel("Tu resultado").fill("0,333");
  await page.getByRole("button", { name: "Comprobar respuesta" }).click();
  await expect(page.getByRole("status")).toContainText("¡Muy bien!");
  await expect(page.getByRole("status").getByRole("listitem")).toContainText("Paso");
  await page.getByRole("button", { name: "Guardar y ver resultado" }).click();
  await expect(page.getByRole("heading", { name: "¡Práctica completada!" })).toBeVisible();
  await page.getByRole("navigation").getByRole("link", { name: "Parciales", exact: true }).click();
  await page.getByRole("button", { name: "Seleccionar visibles" }).click();
  await page.getByRole("button", { name: "Comenzar simulacro" }).click();
  await page.getByLabel("Tu resultado").fill("0.334");
  await page.getByRole("button", { name: "Finalizar simulacro" }).click();
  await expect(page.getByRole("heading", { name: "¡Simulacro completado!" })).toBeVisible();
  await expect(page.locator(".result-score")).toContainText("1 / 1");
  const attempts = await page.evaluate(() => JSON.parse(localStorage.getItem("probabilidad-estadistica-estudio-v1")!).attempts);
  expect(attempts).toHaveLength(2);
  expect(attempts.every((attempt: { answers: { correct: boolean }[] }) => attempt.answers[0].correct)).toBe(true);
});

test("teoría con índice dinámico, fórmulas y tabla", async ({ page }) => {
  const text = (value: string, equation = false) => [{ text: value, equation, bold: false, italic: false, strike: false, underline: false, code: false }];
  const block = (id: string, type: string, value: string) => ({ id, type, text: text(value), children: [] });
  await page.route("**/notion-theory.json", route => route.fulfill({ json: { version: 1, documents: [{ id: `notion-${"1".repeat(32)}`, title: "Documento técnico", category: "Fixture", blocks: [
    block("heading", "heading_1", "Encabezado técnico"),
    block("formula", "equation", "\\frac{1}{3}"),
    { ...block("inline", "paragraph", "x^2"), text: text("x^2", true) },
    { ...block("table", "table", ""), columnHeader: true, children: [{ ...block("row", "table_row", ""), cells: [text("Dato"), text("Valor")] }] },
  ] }] } }));
  await page.goto("./#/teoria");
  await expect(page.getByRole("heading", { name: "Documento técnico" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Encabezado técnico" })).toBeVisible();
  await page.getByRole("complementary", { name: "Índice del documento" }).getByRole("button", { name: "Encabezado técnico" }).click();
  await expect(page.getByRole("heading", { name: "Encabezado técnico" })).toBeFocused();
  await expect(page.locator(".notion-content .katex")).toHaveCount(2);
  await expect(page.getByRole("columnheader", { name: "Dato" })).toBeVisible();
  await page.getByRole("button", { name: "Marcar como estudiado" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Estudiado · Marcar como pendiente" })).toBeVisible();
});

test("fotografías y desarrollo con respuesta modelo y autoevaluación", async ({ page }) => {
  const question = { id: "written-fixture", examId: "fixture", topic: "fixture", prompt: "Desarrollo técnico", type: "written", options: [], correct: null, verified: true, modelAnswer: "Modelo $x^2$", steps: ["Explicación $x$"], explanation: "", tags: [], origin: "Parcial anterior" };
  await page.route("**/exams/catalog.json", route => route.fulfill({ json: { version: 1, exams: [{ id: "fixture", title: "Fixture técnico", topic: "fixture", photos: [{ id: "photo", src: "exams/images/fixture.png", alt: "Imagen de prueba técnica" }] }], questions: [question] } }));
  await page.route("**/exams/images/fixture.png", route => route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") }));
  await page.goto("./#/parciales");
  await page.getByRole("button", { name: "Ver parcial: Fixture técnico" }).click();
  await page.getByRole("button", { name: "Ampliar fotografía 1" }).click();
  const viewer = page.getByRole("dialog", { name: "Visor de fotografías" });
  await expect(viewer).toBeVisible();
  await viewer.getByRole("button", { name: "Ampliar imagen" }).click();
  await expect(viewer.locator(".photo-canvas img")).toHaveCSS("max-width", "none");
  await viewer.getByRole("button", { name: "Cerrar visor" }).click();
  await page.getByRole("navigation", { name: "Secciones de estudio" }).getByRole("link", { name: "Apoyo inteligente" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Practicar 1 pregunta" }).click();
  await page.getByLabel("Tu respuesta").fill("Mi desarrollo");
  await page.getByRole("button", { name: "Comparar con respuesta modelo" }).click();
  await expect(page.locator(".example-box .katex")).toHaveCount(2);
  await page.getByRole("button", { name: "Coincide con el modelo" }).click();
  await page.getByRole("button", { name: "Guardar y ver resultado" }).click();
  const answer = await page.evaluate(() => JSON.parse(localStorage.getItem("probabilidad-estadistica-estudio-v1")!).attempts[0].answers[0]);
  expect(answer).toMatchObject({ correct: true, selfAssessed: true });
});
