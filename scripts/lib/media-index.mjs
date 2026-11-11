import assert from "node:assert/strict";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { loadEnv } from "vite";

export const readJson = async (file) =>
  JSON.parse(await fs.readFile(file, "utf8"));
export const hash = (bytes, algorithm = "sha256") =>
  crypto.createHash(algorithm).update(bytes).digest("hex");

export function validateFiles(files) {
  assert.ok(Array.isArray(files) && files.length > 0, "Empty media index");
  const seen = new Set();
  for (const file of files) {
    assert.match(
      file.url,
      /^(?:media|assets|brand)\/[a-zA-Z0-9_./-]+\.(?:jpe?g|png|webp|gif|avif|dzi)$/,
    );
    assert.ok(
      !file.url
        .split("/")
        .some((part) => !part || part === "." || part === ".."),
      `Unsafe media path: ${file.url}`,
    );
    assert.ok(!seen.has(file.url), `Duplicate media path: ${file.url}`);
    seen.add(file.url);
    assert.ok(
      Number.isSafeInteger(file.bytes) && file.bytes > 0,
      `Invalid size: ${file.url}`,
    );
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
    assert.match(file.md5, /^[a-f0-9]{32}$/);
  }
  return files;
}

export async function readMediaIndex() {
  const index = await readJson("content/media-index.json");
  assert.equal(index.version, 1);
  return validateFiles(index.files);
}

export function assetBase() {
  const base = (
    process.env.VITE_ASSET_BASE_URL ??
    loadEnv("production", process.cwd()).VITE_ASSET_BASE_URL ??
    ""
  )
    .trim()
    .replace(/\/+$/, "");
  assert.match(
    base,
    /^https?:\/\//,
    "Set VITE_ASSET_BASE_URL to an HTTP(S) asset host, or restore from --from <local directory>.",
  );
  const url = new URL(base);
  assert.ok(
    !url.search && !url.hash,
    "Asset base must not contain a query or fragment",
  );
  return base + "/";
}

export function verifyBytes(file, bytes) {
  assert.equal(bytes.length, file.bytes, `Size mismatch: ${file.url}`);
  assert.equal(hash(bytes), file.sha256, `SHA-256 mismatch: ${file.url}`);
}

export async function forEachFile(files, action, concurrency = 8) {
  let next = 0;
  const errors = [];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < files.length) {
        const file = files[next++];
        try {
          await action(file);
        } catch (error) {
          errors.push(new Error(`${file.url}: ${error.message}`));
        }
      }
    }),
  );
  if (errors.length)
    throw new AggregateError(
      errors,
      `${errors.length} media files failed validation`,
    );
}
