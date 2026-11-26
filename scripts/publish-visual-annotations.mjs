// Register already-uploaded batches. No application deployment is required.
// Run with --publish to update the registry after validating every active batch.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  VISUAL_POINTER,
  readSource,
  sourceUrl,
  sha256,
  registryRevision,
  validateRegistry,
  createVisualLoader,
  batchEntries,
} from "../server/ai-search/visual-source.mjs";

const args = process.argv.slice(2),
  publish = args.includes("--publish");
const manifests = args.filter((arg) => !arg.startsWith("--"));
assert(
  manifests.length,
  "Provide one or more OSS manifest.json URLs; add --publish to register them",
);
async function current() {
  try {
    return await readSource(VISUAL_POINTER, { maxBytes: 256 * 1024 });
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}
const previous = await current();
let batches = previous ? [...validateRegistry(previous.data).batches] : [];
for (const value of manifests) {
  const manifestUrl = sourceUrl(value);
  const manifest = await readSource(manifestUrl);
  const annotationsUrl = sourceUrl(
    manifest.data.annotations_file || "annotations.json",
    new URL(".", manifestUrl).href,
  );
  const annotations = await readSource(annotationsUrl);
  batchEntries(annotations.data, manifest.data, manifestUrl);
  const descriptor = {
    manifest: manifestUrl,
    annotations: annotationsUrl,
    manifestSha256: sha256(manifest.bytes),
    annotationsSha256: sha256(annotations.bytes),
  };
  const existing = batches.find(
    (batch) => sourceUrl(batch.manifest) === manifestUrl,
  );
  if (existing && JSON.stringify(existing) === JSON.stringify(descriptor))
    continue;
  batches = [
    ...batches.filter((batch) => sourceUrl(batch.manifest) !== manifestUrl),
    descriptor,
  ];
}
const registry = {
  schemaVersion: 1,
  revision: registryRevision(batches),
  batches,
};
validateRegistry(registry);
const bytes = Buffer.from(JSON.stringify(registry, null, 2) + "\n");
const snapshot = await createVisualLoader({
  fetcher: (url, options) =>
    url === VISUAL_POINTER
      ? Promise.resolve(new Response(bytes))
      : fetch(url, options),
})();
assert(!snapshot.stale, "Batch validation failed; registry was not published");
const directory = path.resolve("output/visual-registry");
await fs.mkdir(directory, { recursive: true });
const file = path.join(directory, `${registry.revision}.json`);
await fs.writeFile(file, bytes);
console.log(
  `Validated ${batches.length} batches, ${snapshot.entries.length} distinct whole-image annotations; revision ${registry.revision}`,
);
if (!publish) {
  console.log(`Prepared ${file}. Add --publish to update OSS.`);
} else if (previous?.data.revision === registry.revision) {
  console.log("Registry already current; no write needed.");
} else {
  // Single-publisher workflow, like the content release command. Refuse to
  // knowingly overwrite an update made while these batches were validated.
  const latest = await current();
  assert.equal(
    latest ? sha256(latest.bytes) : null,
    previous ? sha256(previous.bytes) : null,
    "Registry changed during validation; rerun to merge the latest list",
  );
  if (previous)
    await fs.writeFile(
      path.join(directory, `previous-${Date.now()}.json`),
      previous.bytes,
    );
  const upload = spawnSync(
    "aliyun",
    [
      "ossutil",
      "cp",
      file,
      "oss://halfbvg-art-assets/where-is-art/annotations/visual-semantics/current.json",
      "--region",
      "cn-shanghai",
      "--content-type",
      "application/json; charset=utf-8",
      "--cache-control",
      "no-cache,max-age=0,must-revalidate",
      "--no-progress",
      "--force",
      "--output-dir",
      directory,
    ],
    { encoding: "utf8" },
  );
  assert.equal(upload.status, 0, "OSS registry upload failed");
  const verified = await current();
  assert(
    verified?.bytes.equals(bytes),
    "Published registry read-back mismatch",
  );
  console.log(
    `Published and verified: ${VISUAL_POINTER}\nSearch instances refresh on the next request after their 60-second cache expires.`,
  );
}
