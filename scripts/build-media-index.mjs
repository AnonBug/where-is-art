import fs from "node:fs/promises";
import path from "node:path";
import { hash, readMediaIndex, validateFiles } from "./lib/media-index.mjs";

const files = [];
async function walk(directory) {
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) await walk(file);
    else if (/\.(jpe?g|png|webp|gif|avif|dzi)$/.test(item.name)) {
      const bytes = await fs.readFile(file);
      files.push({
        url: path.relative("public", file).split(path.sep).join("/"),
        bytes: bytes.length,
        sha256: hash(bytes),
        md5: hash(bytes, "md5"),
      });
    }
  }
}
await walk("public");
const urls = new Set(files.map((file) => file.url));
// A partially restored checkout must never erase the rest of the remote index.
try {
  for (const file of await readMediaIndex()) {
    if (!urls.has(file.url))
      throw new Error(
        `Restore all indexed media before rebuilding the index: ${file.url}`,
      );
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
validateFiles(files);
files.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
await fs.writeFile(
  "content/media-index.json",
  JSON.stringify({ version: 1, files }, null, 2) + "\n",
);
console.log(
  `媒体索引：${files.length} 个文件，${files.reduce((sum, file) => sum + file.bytes, 0)} 字节。`,
);
