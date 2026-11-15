# Probabilidad y Estadística

Biblioteca personal de estudio con React, TypeScript y Vite. Reutiliza el diseño y los componentes de la aplicación [Gestión de Calidad](https://github.com/NadiaEnoaRizoAvalos/Gestion_calidad): colores pastel, habitación, conejitos, tarjetas y navegación horizontal. El proyecto original y su historial no se modifican ni se incorporan a este repositorio.

La nueva materia empieza sin apuntes, preguntas, fotografías ni actividades inventadas. Tampoco contiene credenciales, imágenes académicas ni datos de progreso del proyecto anterior. El laboratorio presenta categorías de herramientas pendientes del programa real; todavía no contiene calculadoras ni simuladores.

## Ejecutar y verificar

Usá Node.js 24 y npm. Desde esta carpeta:

```sh
npm ci
npm run dev
```

Abrí la dirección que muestra Vite, con `/Probabilidad_Estadistica/`. Las secciones usan rutas con hash, por ejemplo `/Probabilidad_Estadistica/#/teoria`, para permitir recargar y abrir enlaces directamente en GitHub Pages.

```sh
npm run lint
npm run typecheck
npm test
npm run validate:theory
npm run validate:exams
npm run build
npx playwright install chrome
npx playwright test
```

`npm run test:e2e` compila y ejecuta las pruebas de navegador. Estas verifican navegación, fecha persistente, aislamiento del progreso, fórmulas, tablas, respuestas numéricas y el inicio centrado a 320, 390, 768 y 1440 px. Las capturas quedan en `test-results/`, que no se publica en Git. Los datos sintéticos de las pruebas no se incluyen en la biblioteca.

## Estructura

- `src/pages`: inicio, teoría, laboratorio, parciales, apoyo y ruta de estudio.
- `src/components`: componentes visuales y funciones generales reutilizadas.
- `src/data/laboratory.ts`: categorías para incorporar las herramientas cuando exista material académico.
- `src/data/examCatalog.ts`: formato y validación del banco de exámenes.
- `src/data/numericAnswers.ts`: validación de entradas y comparación con tolerancia.
- `src/hooks`: progreso local y carga de los datos publicados.
- `public/notion-theory.json`: teoría exportada de la nueva fuente.
- `public/exams/catalog.json`: parciales y preguntas, inicialmente vacíos.
- `scripts`: sincronización y validación de la teoría.
- `.github/workflows`: verificaciones, sincronización y publicación.

No hay backend. Apoyo inteligente recomienda a partir de los últimos resultados guardados en el navegador; no llama a un servicio de IA. El progreso usa la clave `probabilidad-estadistica-estudio-v1`. La clave del proyecto original se ignora. Cada navegador guarda su propio progreso y fecha, sin sincronizarlos entre dispositivos.

La ruta se arma con los documentos de teoría publicados y añade la práctica cuando hay preguntas. Sin material, muestra 0% y una indicación de que la ruta está pendiente; no presenta un recorrido completado.

## Configurar una fuente nueva de Notion

1. Creá una base independiente para Probabilidad y Estadística. No uses la base de la otra materia.
2. Creá una conexión interna nueva con permiso de lectura y conectala únicamente a esta base, desde el menú de conexiones de Notion. Seguí la [guía oficial de conexiones](https://www.notion.com/help/create-integrations-with-the-notion-api).
3. La base debe tener una propiedad de título y una propiedad llamada exactamente `Estado`, de tipo **Status** o **Select**, con una única opción `Publicado` (se ignoran mayúsculas). Opcionalmente agregá `Categoría`, de tipo Select, Multi-select o texto.
4. En el repositorio nuevo, abrí **Settings → Secrets and variables → Actions**. Agregá el secreto `NOTION_TOKEN` de esta conexión nueva y la variable `NOTION_THEORY_SOURCE_ID` con el ID de su data source, de 32 caracteres hexadecimales con o sin guiones. No uses una URL ni el ID de una vista. Si la base tiene una sola data source, también se acepta el ID de la base.
5. Publicá al menos un apunte con `Estado = Publicado` y ejecutá **Actions → Sincronizar teoría de Notion → Run workflow**. Luego se ejecutará cada hora, en el minuto 17 UTC, sujeto a la disponibilidad de GitHub Actions.

Sin `NOTION_THEORY_SOURCE_ID`, el trabajo de sincronización se omite y la aplicación vacía se puede publicar normalmente. Los secretos solo se usan en Actions, nunca en variables `VITE_*` ni en el navegador. Para ejecutar la sincronización local, definí `NOTION_TOKEN` y `NOTION_THEORY_SOURCE_ID` como variables del proceso y usá `npm run sync:notion`; el script no carga archivos `.env` por sí solo.

La sincronización exporta únicamente páginas publicadas de la fuente configurada, valida el resultado y descarga las imágenes a `public/notion-images/`. Conserva identificadores estables e índice dinámico de encabezados. Soporta títulos, párrafos, listas, tablas, imágenes PNG/JPEG/GIF/WebP, bloques de fórmula y fórmulas inline de Notion. No atraviesa páginas enlazadas ni bloques sincronizados. Los bloques no compatibles cancelan la exportación para evitar publicar un apunte incompleto. Si no hay páginas publicadas, no se vacía automáticamente un catálogo previo sin verificar su retirada.

Las fórmulas se renderizan con KaTeX, sin habilitar HTML de confianza. Las imágenes de Notion publicadas quedan como archivos estáticos del sitio. **Todo apunte marcado Publicado será visible para quien visite el sitio.**

## Incorporar parciales y ejercicios

Agregá las fotografías a `public/exams/images/` y editá `public/exams/catalog.json`, conservando esta estructura:

```json
{
  "version": 1,
  "exams": [],
  "questions": []
}
```

Los tipos `ExamPaper`, `ExamPhoto` y `Question` describen los campos en `src/data/examCatalog.ts` y `src/types/index.ts`. Cada pregunta debe vincularse mediante `examId` a un examen o colección existente. Si usa `photoId`, debe existir entre las fotos de ese examen. Las rutas de foto admitidas son `exams/images/nombre.png`, `.jpg`, `.jpeg` o `.webp`. Cada examen lleva `id`, `title`, `topic` y `photos`; cada foto lleva `id`, `src` y `alt`.

Los tipos de pregunta son `choice`, `true-false`, `selection`, `written` y `numeric`. Los campos comunes son `id`, `examId`, `topic`, `prompt`, `options`, `correct`, `type`, `verified`, `explanation`, `origin` y `tags`. `origin` es `Parcial anterior` para exámenes o `Pregunta adicional recopilada para estudiar` para grupos con `kind: "collection"`. No marques una respuesta como verificada hasta revisarla con el material real.

- Opción múltiple: `correct` es el índice de la opción correcta.
- Desarrollo: `options: []`, `correct: null` y `modelAnswer`. La práctica compara con el modelo mediante autoevaluación; el simulacro conserva el desarrollo para revisión manual.
- Resultado numérico: `options: []`, `correct: null`, `verified: true` y `numericAnswer: { value, absoluteTolerance, relativeTolerance }`. Todos los números deben ser finitos, las tolerancias no negativas y al menos una mayor que cero. Se acepta coma, punto y notación científica. No se interpretan expresiones ni separadores de miles.
- `steps`, opcional, contiene una lista de explicaciones paso a paso. En títulos, opciones, modelos y explicaciones se pueden usar `$...$` y `$$...$$` para fórmulas LaTeX; en JSON cada barra invertida debe escribirse doble.

La comparación numérica acepta `|respuesta - valor| <= max(tolerancia absoluta, tolerancia relativa × |valor|)`. Elegí tolerancias según la precisión y las unidades exigidas por el ejercicio. Las respuestas sin verificar no se califican como errores ni aciertos.

## Crear o conectar el repositorio de GitHub

Esta carpeta ya tiene un repositorio independiente, con un commit inicial propio y `origin` apuntando a `NadiaEnoaRizoAvalos/Probabilidad_estadistica`. No hace falta crear otro si ese es el destino deseado.

Para usar exactamente `Probabilidad_Estadistica`, podés renombrar ese repositorio desde **Settings → General → Repository name**. Si todavía no existe un destino, creá uno vacío con ese nombre, sin inicializar otro README. Después, desde esta carpeta:

```sh
git remote set-url origin https://github.com/NadiaEnoaRizoAvalos/Probabilidad_Estadistica.git
git push -u origin main
```

Si partís de una copia sin remoto, usá `git remote add origin ...` en lugar de `set-url`. Para próximos cambios usá commits en español con Conventional Commits, por ejemplo `feat(teoria): incorporar apuntes de la materia`.

## Publicar en GitHub Pages

1. Subí los commits del proyecto nuevo a `main`.
2. En **Settings → Pages → Build and deployment → Source**, elegí **GitHub Actions**, según la [documentación oficial de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
3. Habilitá Actions en el repositorio y permití al workflow de sincronización escribir contenido. Una regla que impida pushes directos de Actions a `main` requerirá adaptar la publicación de los datos a un pull request.
4. Ejecutá **Actions → Publicar Probabilidad y Estadística en GitHub Pages**, o subí un commit a `main`. El workflow verifica tipos, datos, pruebas, lint, compilación y navegador antes de desplegar `dist`.

Con el nombre solicitado, la dirección será `https://nadiaenoarizoavalos.github.io/Probabilidad_Estadistica/`. Si conservás el nombre actual, será `https://nadiaenoarizoavalos.github.io/Probabilidad_estadistica/`. Vite y Playwright toman automáticamente el nombre real desde `GITHUB_REPOSITORY` en Actions para respetar mayúsculas y evitar rutas rotas. En local usan `/Probabilidad_Estadistica/`.

La sincronización crea un commit con los datos y, al finalizar correctamente, activa el workflow de publicación. El checkout de publicación toma `main` para incluir ese commit nuevo. El workflow programado puede desactivarse por inactividad del repositorio según las reglas de GitHub; revisá Actions si deja de ejecutarse.

La aplicación queda preparada localmente. La conexión real con Notion y la publicación remota requieren configurar esos servicios y subir los commits.
