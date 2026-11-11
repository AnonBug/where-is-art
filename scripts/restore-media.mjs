import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  assetBase,
  forEachFile,
  readMediaIndex,
  verifyBytes,
} from "./lib/media-index.mjs";

const { values } = parseArgs({
  options: { from: { type: "string" }, prefix: { type: "string" } },
});
const files = (await readMediaIndex()).filter(
  (file) => !values.prefix || file.url.startsWith(values.prefix),
);
if (!files.length) throw new Error("No media matches the requested prefix");
const base = values.from ? undefined : assetBase();
let restored = 0;
await forEachFile(files, async (file) => {
  const destination = path.join("public", file.url);
  try {
    verifyBytes(file, await fs.readFile(destination));
    return;
  } catch (error) {
    // Do not replace a locally edited file or hide permission errors.
    if (error.code !== "ENOENT") throw error;
  }
  let bytes;
  if (values.from) bytes = await fs.readFile(path.join(values.from, file.url));
  else {
    const response = await fetch(base + file.url, {
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  verifyBytes(file, bytes);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, bytes, { flag: "wx" });
  restored++;
});
console.log(
  `媒体恢复完成：新增 ${restored} 个，已有且哈希一致 ${files.length - restored} 个；public/ 媒体目录被 Git 忽略。`,
);
