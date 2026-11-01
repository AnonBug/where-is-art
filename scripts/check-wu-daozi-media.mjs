import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const read = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const sources = await read("content/wu-daozi-sources.json");
const manifest = await read("content/wu-daozi-media-manifest.json");
assert.equal(manifest.images.length, 2);
assert.equal(new Set(manifest.images.map((image) => image.artworkId)).size, 2);
sharp.concurrency(1);
let totalBytes = 0;
let totalTiles = 0;
for (const image of manifest.images) {
  const source = sources.images.find(
    (item) => item.artworkId === image.artworkId,
  );
  assert.ok(source);
  assert.equal(image.sourceHash, source.sha256);
  assert.equal(image.sourceUrl, source.sourceUrl);
  assert.equal(image.sourceImageUrl, source.sourceImageUrl);
  assert.equal(image.publicationStatus, source.publicationStatus);
  assert.equal(image.width, source.width);
  assert.equal(image.height, source.height);
  assert.equal(image.delivery.width, source.width);
  assert.equal(image.delivery.height, source.height);
  assert.equal(image.delivery.kind, "dzi");
  const prefix = `media/wu-daozi/${image.id}/`;
  const listed = new Set();
  for (const file of image.files) {
    assert.ok(file.url.startsWith(prefix) && !file.url.includes(".."));
    assert.ok(!listed.has(file.url));
    listed.add(file.url);
    const bytes = await fs.readFile(path.join("public", file.url));
    assert.equal(bytes.length, file.bytes, file.url);
    assert.equal(
      crypto.createHash("sha256").update(bytes).digest("hex"),
      file.sha256,
      file.url,
    );
    if (!file.url.endsWith(".dzi")) await sharp(bytes).raw().toBuffer();
    totalBytes += bytes.length;
  }
  for (const [resource, limit] of [
    [image.thumbnail, 100_000],
    [image.preview, 500_000],
  ]) {
    assert.ok(listed.has(resource.url));
    const file = image.files.find((file) => file.url === resource.url);
    const metadata = await sharp(path.join("public", resource.url)).metadata();
    assert.equal(resource.bytes, file.bytes);
    assert.ok(resource.bytes <= limit);
    assert.equal(metadata.width, resource.width);
    assert.equal(metadata.height, resource.height);
  }
  const delivery = image.delivery;
  assert.ok(listed.has(delivery.url));
  const xml = await fs.readFile(path.join("public", delivery.url), "utf8");
  const attribute = (name) =>
    Number(xml.match(new RegExp(`${name}="(\\d+)"`))?.[1]);
  for (const [key, value] of Object.entries({
    Width: source.width,
    Height: source.height,
    TileSize: 512,
    Overlap: 1,
  }))
    assert.equal(attribute(key), value);
  assert.ok(xml.includes('Format="jpeg"'));
  const levels = Math.ceil(Math.log2(Math.max(source.width, source.height)));
  let count = 0;
  let bytes = 0;
  let maximum = 0;
  for (let level = 0; level <= levels; level++) {
    const width = Math.ceil(source.width / 2 ** (levels - level));
    const height = Math.ceil(source.height / 2 ** (levels - level));
    const columns = Math.ceil(width / 512),
      rows = Math.ceil(height / 512);
    for (let x = 0; x < columns; x++)
      for (let y = 0; y < rows; y++) {
        const url = `${prefix}detail_files/${level}/${x}_${y}.jpeg`;
        const file = image.files.find((file) => file.url === url);
        assert.ok(file, `Missing tile ${url}`);
        const metadata = await sharp(path.join("public", url)).metadata();
        assert.equal(
          metadata.width,
          Math.min(512, width - x * 512) +
            (x > 0 ? 1 : 0) +
            (x < columns - 1 ? 1 : 0),
        );
        assert.equal(
          metadata.height,
          Math.min(512, height - y * 512) +
            (y > 0 ? 1 : 0) +
            (y < rows - 1 ? 1 : 0),
        );
        count++;
        bytes += file.bytes;
        maximum = Math.max(maximum, file.bytes);
      }
  }
  assert.equal(image.files.length, count + 3);
  assert.equal(delivery.tileCount, count);
  assert.equal(delivery.totalBytes, bytes);
  assert.equal(delivery.maxTileBytes, maximum);
  const actual = await fs.readdir(path.join("public", prefix), {
    recursive: true,
    withFileTypes: true,
  });
  assert.equal(
    actual.filter((entry) => entry.isFile()).length,
    image.files.length,
  );
  totalTiles += count;
}
console.log(
  `吴道子：2 幅传名画卷，${totalTiles} 张瓦片，${(totalBytes / 1e6).toFixed(2)} MB；哈希、全文件解码、完整层级及原始分辨率校验通过。`,
);
