// Backfill a search artifact for an existing immutable content release without
// changing its catalog, index, artwork details, or the current.json pointer.
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { contentRevision } from "./build-content-delivery.mjs";
import {
  CORPUS_FILE,
  createSearchCorpus,
} from "../server/ai-search/corpus.mjs";

const root =
  "https://halfbvg-art-assets.oss-cn-shanghai.aliyuncs.com/where-is-art/content/";
const pointer = await (await fetch(`${root}current.json`)).json();
const revision =
  process.argv.find((x) => /^[a-f0-9]{20}$/.test(x)) || pointer.revision;
assert.match(revision, /^[a-f0-9]{20}$/);
const response = await fetch(`${root}releases/${revision}/catalog.json`, {
  signal: AbortSignal.timeout(30000),
});
assert(response.ok, `Catalog HTTP ${response.status}`);
const catalog = await response.json();
assert.equal(contentRevision(catalog), revision, "Catalog revision mismatch");
const bytes = Buffer.from(
  JSON.stringify(createSearchCorpus(catalog, revision)),
);
const directory = `output/story-search/${revision}`;
await fs.mkdir(directory, { recursive: true });
const file = `${directory}/${CORPUS_FILE}.gz`;
await fs.writeFile(file, gzipSync(bytes, { level: 9 }));
const url = `${root}releases/${revision}/${CORPUS_FILE}`;
const existing = await fetch(url);
if (existing.ok)
  assert(
    Buffer.from(await existing.arrayBuffer()).equals(bytes),
    "Existing immutable search artifact differs",
  );
else {
  assert.equal(existing.status, 404, "Cannot inspect existing artifact");
  if (!process.argv.includes("--publish")) {
    console.log(
      `Prepared ${revision}: ${bytes.length} bytes. Add --publish to upload.`,
    );
    process.exit(0);
  }
  const upload = spawnSync(
    "aliyun",
    [
      "ossutil",
      "cp",
      file,
      `oss://halfbvg-art-assets/where-is-art/content/releases/${revision}/${CORPUS_FILE}`,
      "--region",
      "cn-shanghai",
      "--content-type",
      "application/json; charset=utf-8",
      "--content-encoding",
      "gzip",
      "--cache-control",
      "public,max-age=31536000,immutable",
      "--ignore-existing",
      "--no-progress",
      "--output-dir",
      directory,
    ],
    { encoding: "utf8" },
  );
  assert.equal(upload.status, 0, upload.stderr || upload.stdout);
}
const remote = await fetch(url);
assert(remote.ok);
assert(
  Buffer.from(await remote.arrayBuffer()).equals(bytes),
  "Remote corpus differs",
);
const current = await (await fetch(`${root}current.json`)).json();
assert.equal(
  current.revision,
  pointer.revision,
  "Content pointer moved during verification; inspect the new release",
);
console.log(
  `Search text verified: ${revision}, ${JSON.parse(bytes).documents.length} works, ${(bytes.length / 1000).toFixed(0)} KB; current.json unchanged.`,
);
