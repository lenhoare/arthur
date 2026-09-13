import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import svgr from "vite-plugin-svgr";

const source = (path: string) =>
  fileURLToPath(
    new URL(`./vendor/excalidraw/packages/${path}`, import.meta.url),
  );

export default defineConfig({
  plugins: [react(), svgr()],
  resolve: {
    alias: [
      {
        find: /^@excalidraw\/excalidraw$/,
        replacement: source("excalidraw/index.tsx"),
      },
      {
        find: /^@excalidraw\/excalidraw\/(.*)/,
        replacement: source("excalidraw/$1"),
      },
      { find: /^@excalidraw\/math$/, replacement: source("math/index.ts") },
      { find: /^@excalidraw\/math\/(.*)/, replacement: source("math/$1") },
      { find: /^@excalidraw\/utils$/, replacement: source("utils/index.ts") },
      { find: /^@excalidraw\/utils\/(.*)/, replacement: source("utils/$1") },
    ],
  },
});
