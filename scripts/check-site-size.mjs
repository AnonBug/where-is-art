import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

// GitHub Pages publishes at most 1 GB. Check the actual build, including media.
// https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
async function size(directory) {
  let bytes = 0;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    bytes += entry.isDirectory()
      ? await size(file)
      : (await fs.stat(file)).size;
  }
  return bytes;
}
const bytes = await size("dist");
assert.ok(
  bytes < 1_000_000_000,
  `Published site exceeds the 1 GB Pages limit: ${bytes} bytes`,
);
console.log(`发布体积 ${(bytes / 1e6).toFixed(2)} MB / 1,000 MB`);
