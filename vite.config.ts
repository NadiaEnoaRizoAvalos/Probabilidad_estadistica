import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages paths preserve the repository's actual capitalization.
const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "Probabilidad_estadistica";
export default defineConfig({ plugins: [react()], base: `/${repository}/` });
