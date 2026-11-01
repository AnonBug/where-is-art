import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import sharp from "sharp";

// Cache the downloaded originals outside public/. Keep the native resolution in DZI.
const sources = JSON.parse(
  await fs.readFile("content/wu-daozi-sources.json", "utf8"),
);
const cache = path.resolve(process.argv[2] || "output/wu-daozi-originals");
assert.ok(!cache.startsWith(path.resolve("public") + path.sep));
await fs.mkdir(cache, { recursive: true });
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
sharp.cache({ memory: 32, files: 8, items: 8 });
sharp.concurrency(1);
const images = [];
for (const source of sources.images) {
  const original = path.join(cache, source.file);
  try {
    await fs.access(original);
  } catch {
    const response = await fetch(source.sourceImageUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(
      sha(bytes),
      source.sha256,
      "Downloaded source changed; review required",
    );
    await fs.writeFile(original, bytes);
  }
  const bytes = await fs.readFile(original);
  assert.equal(sha(bytes), source.sha256);
  assert.equal(bytes.length, source.bytes);
  const metadata = await sharp(bytes, { limitInputPixels: false }).metadata();
  assert.equal(metadata.width, source.width);
  assert.equal(metadata.height, source.height);
  assert.ok(!metadata.orientation || metadata.orientation === 1);
  const id = `${source.artworkId}-whole`;
  const prefix = `media/wu-daozi/${id}`;
  const destination = path.join("public", prefix);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const staging = await fs.mkdtemp(
    path.join(path.dirname(destination), ".prepare-"),
  );
  const pipeline = () =>
    sharp(bytes, { limitInputPixels: false }).toColourspace("srgb");
  try {
    const side = Math.min(source.width, source.height);
    const [fx, fy] = source.thumbnailFocus;
    await pipeline()
      .extract({
        left: Math.max(
          0,
          Math.min(
            source.width - side,
            Math.round(source.width * fx - side / 2),
          ),
        ),
        top: Math.max(
          0,
          Math.min(
            source.height - side,
            Math.round(source.height * fy - side / 2),
          ),
        ),
        width: side,
        height: side,
      })
      .resize(320, 320)
      .webp({ quality: 82 })
      .toFile(path.join(staging, "thumb.webp"));
    await pipeline()
      .resize({
        width: 1280,
        height: 1280,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toFile(path.join(staging, "preview.webp"));
    await pipeline()
      .jpeg({ quality: 86, chromaSubsampling: "4:4:4" })
      .tile({ size: 512, overlap: 1, layout: "dz", depth: "onepixel" })
      .toFile(path.join(staging, "detail"));
    const dziFile = path.join(staging, "detail.dzi");
    await fs.writeFile(
      dziFile,
      (await fs.readFile(dziFile, "utf8")).replace(/[\t ]+$/gm, ""),
    );
    await fs.rm(path.join(staging, "detail_files", "vips-properties.xml"), {
      force: true,
    });
    const files = [];
    async function inventory(directory) {
      for (const entry of await fs.readdir(directory, {
        withFileTypes: true,
      })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) await inventory(file);
        else {
          const body = await fs.readFile(file);
          files.push({
            url: `${prefix}/${path.relative(staging, file).split(path.sep).join("/")}`,
            bytes: body.length,
            sha256: sha(body),
          });
        }
      }
    }
    await inventory(staging);
    files.sort((a, b) => a.url.localeCompare(b.url, "en"));
    const resource = async (name) => {
      const m = await sharp(path.join(staging, name)).metadata();
      const f = files.find((file) => file.url === `${prefix}/${name}`);
      return { url: f.url, width: m.width, height: m.height, bytes: f.bytes };
    };
    const tiles = files.filter((file) => file.url.endsWith(".jpeg"));
    assert.ok(tiles.length > 0);
    images.push({
      id,
      artworkId: source.artworkId,
      role: "whole",
      label: "完整画幅",
      order: 0,
      width: source.width,
      height: source.height,
      thumbnail: await resource("thumb.webp"),
      preview: await resource("preview.webp"),
      delivery: {
        kind: "dzi",
        url: `${prefix}/detail.dzi`,
        width: source.width,
        height: source.height,
        tileSize: 512,
        overlap: 1,
        tileCount: tiles.length,
        totalBytes: tiles.reduce((total, file) => total + file.bytes, 0),
        maxTileBytes: Math.max(...tiles.map((file) => file.bytes)),
      },
      sourceUrl: source.sourceUrl,
      sourceImageUrl: source.sourceImageUrl,
      sourceHash: source.sha256,
      credit: source.credit,
      licenseLabel: source.licenseLabel,
      licenseUrl: source.licenseUrl,
      quality: "high",
      publicationStatus: source.publicationStatus,
      processing: {
        version: 1,
        nativeResolution: true,
        jpegQuality: 86,
        chromaSubsampling: "4:4:4",
        originalPublished: false,
      },
      files,
    });
    assert.equal(sha(await fs.readFile(original)), source.sha256);
    await fs.rm(destination, { recursive: true, force: true });
    await fs.rename(staging, destination);
    console.log(
      `${id}: ${source.width} × ${source.height}, ${tiles.length} tiles`,
    );
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}
await fs.writeFile(
  "content/wu-daozi-media-manifest.json",
  JSON.stringify(
    { version: 1, updatedAt: sources.checkedAt, images },
    null,
    2,
  ) + "\n",
);
