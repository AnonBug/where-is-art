import fs from "node:fs/promises";
import path from "node:path";
import {
  forEachFile,
  readMediaIndex,
  verifyBytes,
} from "./lib/media-index.mjs";

const files = await readMediaIndex();
await forEachFile(files, async (file) => {
  verifyBytes(file, await fs.readFile(path.join("public", file.url)));
});
console.log(`本地媒体 SHA-256 校验通过：${files.length} 个文件。`);
