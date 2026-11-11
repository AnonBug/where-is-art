import fs from "node:fs/promises";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const externalMedia = Boolean(
    (process.env.VITE_ASSET_BASE_URL ?? env.VITE_ASSET_BASE_URL ?? "").trim(),
  );
  return {
    plugins: [
      react(),
      {
        name: "publish-json-with-external-media",
        apply: "build",
        async generateBundle() {
          if (!externalMedia) return;
          const visit = async (directory: string) => {
            for (const entry of await fs.readdir(
              path.join("public", directory),
              { withFileTypes: true },
            )) {
              const fileName = path.posix.join(directory, entry.name);
              if (entry.isDirectory()) {
                if (!["media", "brand"].includes(fileName))
                  await visit(fileName);
              } else if (entry.name.endsWith(".json")) {
                this.emitFile({
                  type: "asset",
                  fileName,
                  source: await fs.readFile(path.join("public", fileName)),
                });
              }
            }
          };
          await visit("");
        },
      },
    ],
    base: process.env.PAGES_BASE_PATH || "/",
    build: { outDir: "dist", copyPublicDir: !externalMedia },
  };
});
