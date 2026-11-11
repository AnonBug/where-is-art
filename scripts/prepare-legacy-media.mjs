import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
const legacy = JSON.parse(await fs.readFile("public/data.json", "utf8"));
const legacyImages = JSON.parse(
  await fs.readFile("public/assets/images.json", "utf8"),
);
const images = [];
for (const work of legacy.works) {
  const info = legacyImages[work.id];
  if (!info) continue;
  const sourceFile = path.join("public", info.path);
  const bytes = await fs.readFile(sourceFile);
  const meta = await sharp(bytes).metadata();
  const dir = `media/leonardo/${work.id}`;
  await fs.mkdir(`public/${dir}`, { recursive: true });
  const thumb = await sharp(bytes)
    .resize(320, 320, { fit: "cover", position: "attention" })
    .webp({ quality: 82 })
    .toFile(`public/${dir}/thumb.webp`);
  const preview = await sharp(bytes)
    .resize({
      width: 1280,
      height: 1280,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toFile(`public/${dir}/preview.webp`);
  images.push({
    id: `${work.id}-whole`,
    artworkId: work.id,
    role: "whole",
    label: "全图",
    order: 0,
    width: meta.width,
    height: meta.height,
    thumbnail: {
      url: `${dir}/thumb.webp`,
      width: thumb.width,
      height: thumb.height,
      bytes: thumb.size,
    },
    preview: {
      url: `${dir}/preview.webp`,
      width: preview.width,
      height: preview.height,
      bytes: preview.size,
    },
    delivery: {
      kind: "image",
      url: info.path,
      width: meta.width,
      height: meta.height,
      bytes: bytes.length,
      format: meta.format,
    },
    sourceUrl: info.source,
    sourceImageUrl: info.url,
    sourceHash: crypto.createHash("sha256").update(bytes).digest("hex"),
    credit: info.credit || `${work.title}，图像来源：Wikimedia Commons`,
    licenseLabel: info.licenseLabel || "图像使用信息以来源页为准",
    licenseUrl: info.licenseUrl,
    quality: Math.max(meta.width, meta.height) < 1600 ? "standard" : "high",
    publicationStatus: "review-required",
  });
}
await fs.writeFile(
  "content/legacy-media-manifest.json",
  JSON.stringify({ version: 1, images }, null, 2) + "\n",
);
console.log(
  `达·芬奇媒体已生成：${images.length} 张图像。继续运行 media:index 与 content:build。`,
);
