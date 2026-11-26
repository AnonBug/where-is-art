import { createHash } from "node:crypto";
import { VISUAL_ROOT, ASSET_ROOT, visualPassages } from "./visual.mjs";

export const VISUAL_POINTER = `${VISUAL_ROOT}current.json`;
export const VISUAL_REFRESH_MS = 60_000;
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export const registryRevision = (batches) =>
  sha256(JSON.stringify(batches)).slice(0, 20);
const shaPattern = /^[a-f0-9]{64}$/;
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const text = (value, max) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const fields = [
  "subjects",
  "objects",
  "scene",
  "actions",
  "colors",
  "lighting",
  "composition",
  "visual_style",
  "atmosphere",
  "themes",
  "associations",
  "search_queries",
];

export function sourceUrl(value, base = VISUAL_ROOT) {
  if (!text(value, 1500)) throw new Error("Invalid annotation URL");
  const url = new URL(value, base);
  if (
    !url.href.startsWith(base) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.endsWith(".json")
  )
    throw new Error("Annotation URL outside its source directory");
  return url.href;
}

export function validateRegistry(value) {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.batches) ||
    value.batches.length > 256
  )
    throw new Error("Invalid annotation registry");
  const seen = new Set();
  for (const batch of value.batches) {
    if (
      !object(batch) ||
      !text(batch.manifest, 1500) ||
      !text(batch.annotations, 1500) ||
      !shaPattern.test(batch.manifestSha256) ||
      !shaPattern.test(batch.annotationsSha256)
    )
      throw new Error("Invalid annotation batch descriptor");
    const manifestUrl = sourceUrl(batch.manifest);
    sourceUrl(batch.annotations, new URL(".", manifestUrl).href);
    if (seen.has(manifestUrl)) throw new Error("Duplicate annotation batch");
    seen.add(manifestUrl);
  }
  if (value.revision !== registryRevision(value.batches))
    throw new Error("Annotation registry revision mismatch");
  return value;
}

export function batchEntries(annotations, manifest, manifestUrl) {
  const base = new URL(".", sourceUrl(manifestUrl)).href;
  if (
    !object(annotations) ||
    !object(manifest) ||
    !Array.isArray(manifest.works) ||
    manifest.works.length > 20_000
  )
    throw new Error("Invalid annotation batch");
  const entries = [],
    seen = new Set();
  for (const work of manifest.works) {
    if (
      !object(work) ||
      !text(work.artwork_id, 160) ||
      seen.has(work.artwork_id)
    )
      throw new Error("Invalid annotation artwork ID");
    seen.add(work.artwork_id);
    if (
      ["missing_image", "reference_only"].includes(work.status) ||
      (work.image_role && work.image_role !== "whole")
    )
      continue;
    const a = annotations[work.artwork_id];
    if (
      !object(a) ||
      !text(a.description, 1500) ||
      !text(a.search_text, 1600) ||
      fields.some(
        (key) =>
          !Array.isArray(a[key]) ||
          a[key].length > 32 ||
          a[key].some((v) => !text(v, 160)),
      ) ||
      [a.time_of_day, a.season].some((v) => v !== null && !text(v, 40)) ||
      !Array.isArray(a.emotions) ||
      a.emotions.length > 8 ||
      a.emotions.some(
        (e) =>
          !object(e) ||
          !text(e.label, 40) ||
          !text(e.evidence, 500) ||
          !Number.isInteger(e.intensity) ||
          e.intensity < 1 ||
          e.intensity > 5,
      )
    )
      throw new Error(`Invalid annotation fields: ${work.artwork_id}`);
    if (
      !text(work.image_id, 200) ||
      !text(work.image_url, 1500) ||
      !work.image_url.startsWith(ASSET_ROOT) ||
      !shaPattern.test(work.image_sha256)
    )
      throw new Error("Invalid annotation image");
    const annotationUrl = sourceUrl(work.annotation_file, base);
    // Validate the exact passages before accepting a new remote snapshot.
    visualPassages(a, annotationUrl, work.image_url);
    entries.push({ work, annotation: a, annotationUrl });
  }
  return entries;
}

export async function readSource(
  url,
  { fetcher = fetch, maxBytes = 12 * 1024 * 1024, signal } = {},
) {
  const response = await fetcher(url, {
    redirect: "error",
    cache: "no-store",
    signal: signal || AbortSignal.timeout(8000),
  });
  if (!response.ok)
    throw Object.assign(
      new Error(`Annotation source HTTP ${response.status}`),
      { status: response.status },
    );
  if (Number(response.headers.get("content-length")) > maxBytes)
    throw new Error("Annotation source too large");
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("Annotation source too large");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  }
  const bytes = Buffer.concat(chunks);
  return { bytes, data: JSON.parse(bytes.toString("utf8")) };
}

// Refresh on the first request after TTL. Concurrent requests share one load;
// a bad/incomplete release never replaces the last fully validated snapshot.
export function createVisualLoader({
  fetcher = fetch,
  now = Date.now,
  ttl = VISUAL_REFRESH_MS,
  pointerUrl = VISUAL_POINTER,
} = {}) {
  sourceUrl(pointerUrl);
  let snapshot = null,
    nextCheck = 0,
    pending = null,
    batches = new Map(),
    stale = false;
  async function refresh() {
    const signal = AbortSignal.timeout(12_000);
    const registry = validateRegistry(
      (await readSource(pointerUrl, { fetcher, signal, maxBytes: 256 * 1024 }))
        .data,
    );
    if (snapshot?.revision === registry.revision) return snapshot;
    const loaded = new Array(registry.batches.length);
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(4, loaded.length) }, async () => {
        while (cursor < registry.batches.length) {
          const index = cursor++,
            descriptor = registry.batches[index];
          const key = JSON.stringify(descriptor);
          if (batches.has(key)) {
            loaded[index] = { key, entries: batches.get(key) };
            continue;
          }
          const manifestUrl = sourceUrl(descriptor.manifest);
          const [manifest, annotations] = await Promise.all([
            readSource(manifestUrl, { fetcher, signal }),
            readSource(
              sourceUrl(descriptor.annotations, new URL(".", manifestUrl).href),
              { fetcher, signal },
            ),
          ]);
          if (
            sha256(manifest.bytes) !== descriptor.manifestSha256 ||
            sha256(annotations.bytes) !== descriptor.annotationsSha256
          )
            throw new Error("Annotation batch checksum mismatch");
          loaded[index] = {
            key,
            entries: batchEntries(annotations.data, manifest.data, manifestUrl),
          };
        }
      }),
    );
    const merged = new Map();
    // Registry order defines precedence: the last batch wins for the same ID.
    for (const batch of loaded)
      for (const entry of batch.entries)
        merged.set(entry.work.artwork_id, entry);
    if (merged.size > 20_000) throw new Error("Annotation registry too large");
    const next = { revision: registry.revision, entries: [...merged.values()] };
    batches = new Map(loaded.map((batch) => [batch.key, batch.entries]));
    snapshot = next;
    return next;
  }
  return async function load() {
    if (now() >= nextCheck && !pending) {
      pending = refresh()
        .then(() => {
          stale = false;
          nextCheck = now() + ttl;
        })
        .catch(() => {
          stale = true;
          nextCheck = now() + 10_000;
        })
        .finally(() => {
          pending = null;
        });
    }
    if (pending) await pending;
    return { ...(snapshot || { revision: "unavailable", entries: [] }), stale };
  };
}
