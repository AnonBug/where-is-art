#!/usr/bin/env node
// Rebuild only the researched Western corpus. Downloaded source files stay
// outside public/; CI validates the committed derivatives without network I/O.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = path.resolve(
  process.argv[2] || path.join(root, "output/foreign-originals"),
);
const sources = JSON.parse(
  await fs.readFile(path.join(root, "content/foreign-sources.json"), "utf8"),
);
const sha256 = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
// Bump this whenever encoding settings or size limits change.
const profile = "web-v1-jpeg84-webp84-3840";
const manifestPath = path.join(root, "content/foreign-media-manifest.json");
let previous = [];
try {
  previous = JSON.parse(await fs.readFile(manifestPath, "utf8")).images;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
sharp.concurrency(1);
sharp.cache({ memory: 32, files: 4, items: 8 });
await fs.mkdir(sourceRoot, { recursive: true });

async function sourceBytes(source) {
  assert.match(source.artworkId, /^[a-z0-9-]+$/);
  assert.equal(source.cacheFilename, `${source.artworkId}.jpg`);
  assert.match(source.downloadSha256, /^[a-f0-9]{64}$/);
  const file = path.join(sourceRoot, source.cacheFilename);
  let bytes;
  try {
    bytes = await fs.readFile(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    assert.equal(new URL(source.downloadUrl).protocol, "https:");
    const response = await fetch(source.downloadUrl, {
      signal: AbortSignal.timeout(90_000),
    });
    assert.ok(
      response.ok,
      `Download failed (${response.status}): ${source.artworkId}`,
    );
    assert.ok(response.headers.get("content-type")?.startsWith("image/"));
    assert.ok(Number(response.headers.get("content-length")) <= 100_000_000);
    const chunks = [];
    let total = 0;
    for await (const chunk of response.body) {
      total += chunk.length;
      assert.ok(total <= 100_000_000, "Source exceeds download budget");
      chunks.push(chunk);
    }
    bytes = Buffer.concat(chunks);
    assert.equal(
      sha256(bytes),
      source.downloadSha256,
      `Source changed; recheck its identity and rights: ${source.artworkId}`,
    );
    await fs.writeFile(file, bytes);
    // The Art Institute asks clients to download sequentially, one second apart.
    await new Promise((resolve) => setTimeout(resolve, 1_100));
  }
  assert.equal(
    sha256(bytes),
    source.downloadSha256,
    `Source checksum mismatch: ${file}`,
  );
  return bytes;
}

async function publish(bytes, directory, filename, size, byteLimit, format) {
  for (const quality of [84, 80, 74, 68, 60]) {
    const pipeline = sharp(bytes)
      .rotate()
      .resize({ ...size, withoutEnlargement: true })
      .toColourspace("srgb");
    const output = await (
      format === "jpeg"
        ? pipeline
            .flatten({ background: "#faf8f0" })
            .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:2:0" })
        : pipeline.webp({ quality })
    ).toBuffer({ resolveWithObject: true });
    if (output.data.length > byteLimit) continue;
    await fs.writeFile(
      path.join(root, "public", directory, filename),
      output.data,
    );
    return {
      url: `${directory}/${filename}`,
      width: output.info.width,
      height: output.info.height,
      bytes: output.data.length,
      sha256: sha256(output.data),
    };
  }
  throw new Error(`Could not meet file budget: ${directory}/${filename}`);
}

const images = [];
for (const source of sources.sources) {
  const bytes = await sourceBytes(source);
  const existing = previous.find(
    (image) => image.artworkId === source.artworkId,
  );
  if (
    existing?.processing?.profile === profile &&
    existing.sourceHash === source.downloadSha256 &&
    existing.sourceUrl === source.sourceUrl &&
    existing.sourceImageUrl === source.downloadUrl &&
    existing.credit === source.credit &&
    existing.licenseLabel === source.licenseLabel &&
    existing.licenseUrl === source.licenseUrl
  ) {
    // Only reuse derivatives that still match their recorded contents.
    const valid = await Promise.all(
      [existing.thumbnail, existing.preview, existing.delivery].map(
        async (resource) => {
          if (
            !resource.url.startsWith(`media/foreign/${source.artworkId}/`) ||
            resource.url.includes("..")
          )
            return false;
          try {
            const stored = await fs.readFile(
              path.join(root, "public", resource.url),
            );
            return (
              stored.length === resource.bytes &&
              sha256(stored) === resource.sha256
            );
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
            return false;
          }
        },
      ),
    );
    if (valid.every(Boolean)) {
      images.push(existing);
      continue;
    }
  }
  const metadata = await sharp(bytes).metadata();
  const directory = `media/foreign/${source.artworkId}`;
  await fs.mkdir(path.join(root, "public", directory), { recursive: true });
  const thumbnail = await publish(
    bytes,
    directory,
    "thumb.webp",
    { width: 320, height: 320, fit: "cover", position: "attention" },
    100_000,
    "webp",
  );
  const preview = await publish(
    bytes,
    directory,
    "preview.webp",
    { width: 1280, height: 1280, fit: "inside" },
    500_000,
    "webp",
  );
  const full = await publish(
    bytes,
    directory,
    "detail.jpg",
    { width: 3840, height: 3840, fit: "inside" },
    20_000_000,
    "jpeg",
  );
  assert.ok(full.width * full.height <= 3840 ** 2);
  images.push({
    id: `${source.artworkId}-whole`,
    artworkId: source.artworkId,
    role: "whole",
    label: "全图",
    order: 0,
    width: full.width,
    height: full.height,
    thumbnail,
    preview,
    delivery: { kind: "image", ...full, format: "jpeg" },
    sourceUrl: source.sourceUrl,
    sourceImageUrl: source.downloadUrl,
    sourceHash: source.downloadSha256,
    credit: source.credit,
    licenseLabel: source.licenseLabel,
    licenseUrl: source.licenseUrl,
    quality: Math.max(full.width, full.height) >= 1600 ? "high" : "standard",
    publicationStatus: "cleared",
    processing: {
      profile,
      sourceWidth: metadata.width,
      sourceHeight: metadata.height,
      sourceBytes: bytes.length,
      downloadKind: source.downloadKind,
      longestEdgeLimit: 3840,
      note: "网页全图保留画面比例，最长边不超过3840像素，不放大源图；原始来源与下载版本分别记录。",
    },
  });
  console.log(
    `${source.artworkId}: ${full.width}×${full.height}, ${(full.bytes / 1_000_000).toFixed(2)} MB`,
  );
}
await fs.writeFile(
  manifestPath,
  JSON.stringify(
    { version: 1, updatedAt: sources.updatedAt, images },
    null,
    2,
  ) + "\n",
);
console.log(`Prepared ${images.length} Western painting images.`);
