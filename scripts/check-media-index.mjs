import assert from "node:assert/strict";
import { readJson, readMediaIndex } from "./lib/media-index.mjs";

const files = await readMediaIndex();
const byUrl = new Map(files.map((file) => [file.url, file]));
const used = new Set();
function requireFile(url) {
  const file = byUrl.get(url);
  assert.ok(file, `Missing media in index: ${url}`);
  used.add(url);
  return file;
}
const catalog = await readJson("public/catalog.json");
const manifests = await Promise.all(
  [
    "tang-expansion-media-manifest.json",
    "media-manifest.json",
    "foreign-media-manifest.json",
    "wu-daozi-media-manifest.json",
    "legacy-media-manifest.json",
  ].map((name) => readJson(`content/${name}`)),
);
const publishedImages = manifests.flatMap((manifest, index) =>
  manifest.images.map((image) => {
    if (index !== 0 && index !== 3) return image;
    const { files, processing, ...published } = image;
    return published;
  }),
);
assert.deepEqual(
  catalog.images,
  publishedImages,
  "Run content:build after changing media metadata",
);

let tiles = 0;
for (const image of catalog.images) {
  for (const resource of [image.thumbnail, image.preview, image.delivery]) {
    const file = requireFile(resource.url);
    if ("bytes" in resource)
      assert.equal(
        file.bytes,
        resource.bytes,
        `Size mismatch: ${resource.url}`,
      );
    if (resource.sha256)
      assert.equal(
        file.sha256,
        resource.sha256,
        `Hash mismatch: ${resource.url}`,
      );
    assert.ok(resource.width > 0 && resource.height > 0);
  }
  assert.ok(image.thumbnail.bytes <= 100_000, image.id);
  assert.ok(image.preview.bytes <= 500_000, image.id);
  const delivery = image.delivery;
  assert.equal(delivery.width, image.width);
  assert.equal(delivery.height, image.height);
  if (delivery.kind === "image") {
    assert.ok(delivery.bytes <= 20_000_000, image.id);
    continue;
  }
  assert.equal(delivery.kind, "dzi");
  assert.match(delivery.url, /\/detail\.dzi$/);
  assert.equal(delivery.tileSize, 512);
  assert.equal(delivery.overlap, 1);
  const prefix = delivery.url.replace(/\.dzi$/, "_files/");
  const maxLevel = Math.ceil(Math.log2(Math.max(image.width, image.height)));
  let count = 0,
    bytes = 0,
    maximum = 0;
  for (let level = 0; level <= maxLevel; level++) {
    const factor = 2 ** (maxLevel - level);
    const columns = Math.ceil(
      Math.ceil(image.width / factor) / delivery.tileSize,
    );
    const rows = Math.ceil(
      Math.ceil(image.height / factor) / delivery.tileSize,
    );
    for (let x = 0; x < columns; x++)
      for (let y = 0; y < rows; y++) {
        const file = requireFile(`${prefix}${level}/${x}_${y}.jpeg`);
        count++;
        bytes += file.bytes;
        maximum = Math.max(maximum, file.bytes);
      }
  }
  assert.equal(count, delivery.tileCount, image.id);
  assert.equal(bytes, delivery.totalBytes, image.id);
  assert.equal(maximum, delivery.maxTileBytes, image.id);
  tiles += count;
}
for (const manifest of manifests)
  for (const image of manifest.images) {
    for (const file of image.files ?? []) {
      const indexed = requireFile(file.url);
      assert.equal(indexed.bytes, file.bytes, file.url);
      assert.equal(indexed.sha256, file.sha256, file.url);
    }
  }
const legacy = await readJson("public/assets/images.json");
for (const [id, image] of Object.entries(legacy)) {
  const file = requireFile(image.path);
  const published = catalog.images.find((item) => item.id === `${id}-whole`);
  assert.equal(file.bytes, image.bytes, id);
  assert.equal(published.sourceHash, file.sha256, id);
  assert.equal(published.sourceUrl, image.source, id);
  assert.equal(published.sourceImageUrl, image.url, id);
}
requireFile("brand/logo.png");
for (const file of files)
  assert.ok(used.has(file.url), `Unreferenced media in index: ${file.url}`);
console.log(
  `媒体元数据校验通过：${files.length} 个文件，${catalog.images.length} 张图像，${tiles} 张瓦片。未读取媒体二进制文件，也未访问网络。`,
);
