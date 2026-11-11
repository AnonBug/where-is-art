#!/usr/bin/env node
// Rebuild the source-pinned Titian / Rembrandt additions; never changes cloud objects.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
const read = async (p) => JSON.parse(await fs.readFile(p, "utf8"));
const sources = await read("content/masters-sources.json");
const sourceRoot = path.resolve(
  process.argv[2] || "output/masters-expansion/originals",
);
const manifestPath = "content/masters-media-manifest.json";
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex");
const profile = "masters-v1-jpeg84-webp84-3840";
let previous = [];
try {
  previous = (await read(manifestPath)).images;
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const old = new Map(previous.map((i) => [i.artworkId, i]));
sharp.concurrency(1);
sharp.cache({ memory: 32, files: 4, items: 8 });
await fs.mkdir(sourceRoot, { recursive: true });
async function encode(bytes, directory, filename, size, limit, format) {
  for (const quality of [84, 80, 74, 68, 60]) {
    const pipeline = sharp(bytes)
      .rotate()
      .resize({ ...size, withoutEnlargement: true })
      .toColourspace("srgb");
    const { data, info } = await (
      format === "jpeg"
        ? pipeline
            .flatten({ background: "#faf8f0" })
            .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:2:0" })
        : pipeline.webp({ quality })
    ).toBuffer({ resolveWithObject: true });
    if (data.length > limit) continue;
    await fs.writeFile(path.join("public", directory, filename), data);
    return {
      url: `${directory}/${filename}`,
      width: info.width,
      height: info.height,
      bytes: data.length,
      sha256: hash(data),
    };
  }
  throw new Error(`Image budget exceeded: ${directory}/${filename}`);
}
async function prepare(source) {
  assert.match(source.artworkId, /^[a-z0-9-]+$/);
  assert.equal(source.cacheFilename, `${source.artworkId}.bin`);
  assert.match(source.downloadSha256, /^[a-f0-9]{64}$/);
  const local = path.join(sourceRoot, source.cacheFilename);
  let bytes;
  try {
    bytes = await fs.readFile(local);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    const response = await fetch(source.downloadUrl, {
      signal: AbortSignal.timeout(90_000),
    });
    assert.ok(
      response.ok && response.headers.get("content-type")?.startsWith("image/"),
    );
    const chunks = [];
    let total = 0;
    for await (const chunk of response.body) {
      total += chunk.length;
      assert.ok(total <= 100_000_000);
      chunks.push(chunk);
    }
    bytes = Buffer.concat(chunks);
    assert.equal(
      hash(bytes),
      source.downloadSha256,
      `Changed source: ${source.artworkId}`,
    );
    await fs.writeFile(local, bytes);
  }
  assert.equal(
    hash(bytes),
    source.downloadSha256,
    `Changed local source: ${source.artworkId}`,
  );
  const existing = old.get(source.artworkId);
  if (
    existing?.processing.profile === profile &&
    existing.sourceHash === source.downloadSha256 &&
    existing.sourceUrl === source.sourceUrl &&
    existing.role === source.role
  ) {
    const resources = [existing.thumbnail, existing.preview, existing.delivery];
    const valid = await Promise.all(
      resources.map(async (r) => {
        try {
          const b = await fs.readFile(path.join("public", r.url));
          return b.length === r.bytes && hash(b) === r.sha256;
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
          return false;
        }
      }),
    );
    if (valid.every(Boolean))
      return {
        ...existing,
        credit: source.credit,
        licenseLabel: source.licenseLabel,
        licenseUrl: source.licenseUrl,
      };
  }
  const metadata = await sharp(bytes).metadata();
  const directory = `media/masters/${source.artworkId}/${source.downloadSha256.slice(0, 12)}`;
  await fs.mkdir(path.join("public", directory), { recursive: true });
  const thumbnail = await encode(
    bytes,
    directory,
    "thumb.webp",
    { width: 320, height: 320, fit: "cover", position: "attention" },
    100_000,
    "webp",
  );
  const preview = await encode(
    bytes,
    directory,
    "preview.webp",
    { width: 1280, height: 1280, fit: "inside" },
    500_000,
    "webp",
  );
  const full = await encode(
    bytes,
    directory,
    "detail.jpg",
    { width: 3840, height: 3840, fit: "inside" },
    20_000_000,
    "jpeg",
  );
  return {
    id: `${source.artworkId}-${source.role}`,
    artworkId: source.artworkId,
    role: source.role,
    label: source.role === "reference" ? "原作的版画参考" : "全图",
    order: 0,
    width: full.width,
    height: full.height,
    thumbnail,
    preview,
    delivery: { kind: "image", format: "jpeg", ...full },
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
      longestEdgeLimit: 3840,
      note: "保留原比例与来源许可；不放大原图；缩略图为裁切图，预览与全图为完整画面。",
    },
  };
}
const images = new Array(sources.sources.length);
let next = 0,
  finished = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (next < sources.sources.length) {
      const i = next++;
      images[i] = await prepare(sources.sources[i]);
      if (++finished % 25 === 0)
        console.log(`Prepared ${finished}/${images.length}`);
    }
  }),
);
await fs.writeFile(
  manifestPath,
  JSON.stringify(
    { version: 1, updatedAt: sources.updatedAt, images },
    null,
    2,
  ) + "\n",
);
console.log(`Prepared ${images.length} Titian / Rembrandt images.`);
