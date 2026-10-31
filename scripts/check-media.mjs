#!/usr/bin/env node
/** Validate the deployable media tree; no source originals are required in CI. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require("sharp");
} catch {
  sharp = require(
    path.resolve(projectRoot, "../漫览画廊/art-gallery/node_modules/sharp"),
  );
}
sharp.cache({ memory: 16, files: 8, items: 8 });
sharp.concurrency(1);
const publicRoot = path.join(projectRoot, "public");
const manifest = JSON.parse(
  await fs.readFile(
    path.join(projectRoot, "content/media-manifest.json"),
    "utf8",
  ),
);
const seen = new Set();
let totalTiles = 0;
let totalBytes = 0;
let maxImageBytes = 0;
const warnings = [];

function resolveMediaUrl(url) {
  assert.equal(typeof url, "string");
  assert.match(
    url,
    /^media\/tang-yin\/[a-z0-9-]+\//,
    `Invalid media path: ${url}`,
  );
  const filename = path.resolve(publicRoot, url);
  assert.ok(
    filename.startsWith(publicRoot + path.sep) && !url.includes(".."),
    "Path escapes public root",
  );
  return filename;
}
async function checkImage(resource, byteLimit, fullDecode = false) {
  const filename = resolveMediaUrl(resource.url);
  const bytes = (await fs.stat(filename)).size;
  const metadata = await sharp(filename, {
    limitInputPixels: false,
  }).metadata();
  assert.equal(bytes, resource.bytes, `Byte count mismatch: ${resource.url}`);
  assert.ok(bytes <= byteLimit, `File budget exceeded: ${resource.url}`);
  assert.equal(
    metadata.width,
    resource.width,
    `Width mismatch: ${resource.url}`,
  );
  assert.equal(
    metadata.height,
    resource.height,
    `Height mismatch: ${resource.url}`,
  );
  if (fullDecode)
    await sharp(filename, { limitInputPixels: false }).raw().toBuffer();
  totalBytes += bytes;
}

assert.equal(manifest.version, 1);
assert.equal(
  manifest.images.length,
  34,
  "The Tang Yin corpus must contain 34 source images",
);
assert.equal(
  new Set(manifest.images.map((x) => x.artworkId)).size,
  17,
  "The corpus must represent 17 works",
);
assert.equal(manifest.images.filter((x) => x.role === "whole").length, 17);
assert.equal(manifest.images.filter((x) => x.role === "detail").length, 17);
assert.equal(
  manifest.images.filter((x) => x.delivery.kind === "dzi").length,
  6,
);
assert.ok(
  !JSON.stringify(manifest).includes("/Users/"),
  "Public manifest contains private local paths",
);

for (const image of manifest.images) {
  assert.ok(!seen.has(image.id), `Duplicate image ID: ${image.id}`);
  seen.add(image.id);
  assert.match(image.sourceHash, /^[a-f0-9]{64}$/);
  assert.match(image.sourceUrl, /^https:\/\//);
  assert.ok(["cleared", "review-required"].includes(image.publicationStatus));
  if (image.publicationStatus === "review-required")
    warnings.push(`${image.id}: ${image.licenseLabel}`);
  await checkImage(image.thumbnail, 100_000);
  await checkImage(image.preview, 500_000);
  const source = image.delivery;
  assert.equal(source.width, image.width);
  assert.equal(source.height, image.height);
  if (source.kind === "image") {
    await checkImage(source, 20_000_000);
    maxImageBytes = Math.max(maxImageBytes, source.bytes);
    continue;
  }
  assert.equal(source.kind, "dzi");
  assert.equal(source.tileSize, 512);
  assert.equal(source.overlap, 1);
  assert.ok(image.processing.boundedMasterBytes <= 20_000_000);
  assert.equal(image.processing.boundedMasterPublished, false);
  const dziFile = resolveMediaUrl(source.url);
  const xml = await fs.readFile(dziFile, "utf8");
  totalBytes += Buffer.byteLength(xml);
  const attribute = (name) =>
    Number(xml.match(new RegExp(`${name}="(\\d+)"`))?.[1]);
  assert.equal(
    attribute("Width"),
    source.width,
    `DZI width mismatch: ${image.id}`,
  );
  assert.equal(attribute("Height"), source.height);
  assert.equal(attribute("TileSize"), source.tileSize);
  assert.equal(attribute("Overlap"), source.overlap);
  const tileFormat = xml.match(/Format="(jpe?g)"/)?.[1];
  assert.ok(tileFormat, "DZI tiles must use JPEG");
  const tileRoot = dziFile.replace(/\.dzi$/, "_files");
  const maxLevel = Math.ceil(Math.log2(Math.max(source.width, source.height)));
  let tileCount = 0;
  let tileBytes = 0;
  let maxTileBytes = 0;
  for (let level = 0; level <= maxLevel; level += 1) {
    const factor = 2 ** (maxLevel - level);
    const width = Math.ceil(source.width / factor);
    const height = Math.ceil(source.height / factor);
    const columns = Math.ceil(width / source.tileSize);
    const rows = Math.ceil(height / source.tileSize);
    const filenames = await fs.readdir(path.join(tileRoot, String(level)));
    assert.equal(
      filenames.length,
      columns * rows,
      `Unexpected tile count at ${image.id}, level ${level}`,
    );
    for (let x = 0; x < columns; x += 1) {
      for (let y = 0; y < rows; y += 1) {
        const filename = path.join(
          tileRoot,
          String(level),
          `${x}_${y}.${tileFormat}`,
        );
        const bytes = (await fs.stat(filename)).size;
        assert.ok(bytes > 0, `Empty tile: ${filename}`);
        const metadata = await sharp(filename).metadata();
        const expectedWidth =
          Math.min(source.tileSize, width - x * source.tileSize) +
          (x > 0 ? 1 : 0) +
          (x < columns - 1 ? 1 : 0);
        const expectedHeight =
          Math.min(source.tileSize, height - y * source.tileSize) +
          (y > 0 ? 1 : 0) +
          (y < rows - 1 ? 1 : 0);
        assert.equal(
          metadata.width,
          expectedWidth,
          `Tile width: ${image.id}/${level}/${x}_${y}`,
        );
        assert.equal(
          metadata.height,
          expectedHeight,
          `Tile height: ${image.id}/${level}/${x}_${y}`,
        );
        if (x === columns - 1 || y === rows - 1)
          await sharp(filename).raw().toBuffer();
        tileCount += 1;
        tileBytes += bytes;
        maxTileBytes = Math.max(maxTileBytes, bytes);
      }
    }
  }
  assert.equal(tileCount, source.tileCount);
  assert.equal(tileBytes, source.totalBytes);
  assert.equal(maxTileBytes, source.maxTileBytes);
  const directoryFiles = await fs.readdir(path.dirname(dziFile));
  assert.ok(
    !directoryFiles.includes("detail.jpg") &&
      !directoryFiles.includes("bounded-master.jpg"),
    "DZI must not publish a giant fallback image",
  );
  if (tileBytes > 30_000_000)
    warnings.push(`${image.id}: pyramid exceeds 30 MB reference budget`);
  totalTiles += tileCount;
  totalBytes += tileBytes;
}

const detailCounts = ["tang-yin-11", "tang-yin-13"].map(
  (id) =>
    manifest.images.filter((x) => x.artworkId === id && x.role === "detail")
      .length,
);
assert.deepEqual(detailCounts, [12, 5]);
const tea = manifest.images.find((x) => x.id === "tang-yin-02-whole");
assert.deepEqual([tea.width, tea.height], [42561, 3688]);
const palace = manifest.images.find((x) => x.id === "tang-yin-01-whole");
assert.deepEqual([palace.width, palace.height], [6845, 12694]);
const lowResolution = manifest.images.find((x) => x.id === "tang-yin-15-whole");
assert.deepEqual(
  [lowResolution.width, lowResolution.height, lowResolution.quality],
  [423, 800, "standard"],
);
console.log(
  JSON.stringify(
    {
      status: "passed",
      images: seen.size,
      artworks: 17,
      dzi: 6,
      tiles: totalTiles,
      deployableBytes: totalBytes,
      largestImageBytes: maxImageBytes,
      warnings,
    },
    null,
    2,
  ),
);
