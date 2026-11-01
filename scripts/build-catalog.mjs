import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
const read = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const tang = await read("content/tang-catalog.json");
const media = await read("content/media-manifest.json");
const foreign = await read("content/foreign-catalog.json");
const foreignMedia = await read("content/foreign-media-manifest.json");
const wuDaozi = await read("content/wu-daozi-catalog.json");
const wuDaoziMedia = await read("content/wu-daozi-media-manifest.json");
const legacy = await read("public/data.json");
const legacyImages = await read("public/assets/images.json");
const periods = [
  ...wuDaozi.periods,
  { id: "ming", category: "china", name: "明", dateLabel: "1368—1644" },
  ...foreign.periods,
];
const artists = [
  ...wuDaozi.artists,
  {
    id: "tang-yin",
    name: "唐寅",
    category: "china",
    periodId: "ming",
    lifeLabel: "1470—1524",
    countryLabel: "中国",
  },
  {
    id: "leonardo",
    name: "列奥纳多·达·芬奇",
    category: "foreign",
    periodId: "renaissance",
    lifeLabel: "1452—1519",
    countryLabel: "意大利",
  },
  {
    id: "verrocchio",
    name: "安德烈亚·德尔·韦罗基奥",
    category: "foreign",
    periodId: "renaissance",
    lifeLabel: "约1435—1488",
    countryLabel: "意大利",
  },
  ...foreign.artists,
];
const artworks = [
  ...wuDaozi.artworks,
  ...tang.artworks.map((work) => ({
    id: work.id,
    title: work.title,
    artistIds: ["tang-yin"],
    dateLabel: work.dateLabel,
    medium: work.medium,
    description: work.description,
    sourceUrl: work.sourceUrl,
    note: work.holdingNote || "",
  })),
  ...legacy.works.map((work) => ({
    id: work.id,
    title: work.title,
    artistIds: work.artistIds,
    dateLabel: work.date,
    medium: work.medium,
    description: work.description,
    sourceUrl: work.source,
    note: [
      work.kind === "归属争议" ? "作者归属存在争议。" : "",
      work.note,
      work.look,
    ]
      .filter(Boolean)
      .join(" "),
  })),
  ...foreign.artworks,
];
const venues = [
  ...wuDaozi.venues,
  ...tang.venues,
  ...Object.entries(legacy.museums).map(([id, venue]) => ({
    id,
    name: venue.name,
    city: venue.city,
    country: venue.country,
    coordinates: [venue.lng, venue.lat],
    sourceUrl: venue.source,
    coordinateNote: "机构参考位置，不代表具体展厅或实时展出。",
  })),
  ...foreign.venues,
];
const holdings = [
  ...wuDaozi.holdings,
  ...tang.artworks
    .filter((work) => work.venueId)
    .map((work) => ({
      artworkId: work.id,
      venueId: work.venueId,
      note: work.holdingNote || "",
      verifiedAt: "2026-10-31",
      sourceUrl: work.sourceUrl,
    })),
  ...legacy.works
    .filter((work) => work.museum)
    .map((work) => ({
      artworkId: work.id,
      venueId: work.museum,
      note: "沿用已整理馆藏记录，非实时展出信息。",
      verifiedAt: "2026-10-20",
      sourceUrl: work.source,
    })),
  ...foreign.holdings,
];
const topics = [
  {
    id: "landscape",
    title: "山水之间",
    description: "循着唐寅的山川、溪流与庭院，走进纸上的天地。",
    artworkIds: [
      "tang-yin-02",
      "tang-yin-03",
      "tang-yin-04",
      "tang-yin-07",
      "tang-yin-08",
      "tang-yin-09",
      "tang-yin-10",
      "tang-yin-11",
      "tang-yin-17",
      "tang-yin-18",
    ],
  },
  {
    id: "signature",
    title: "一人一幅成名作",
    description: "从唐寅与达·芬奇各选一幅代表作，走近两种笔墨。",
    artworkIds: ["tang-yin-06", "mona"],
  },
  {
    id: "leonardo",
    title: "达·芬奇的世界",
    description: "传世绘画、合作与争议，21 件作品的收藏足迹。",
    artworkIds: legacy.works.map((work) => work.id),
  },
  ...foreign.topics,
];
// File hashes are build/CI evidence; the viewer only needs the image contract.
const images = [
  ...media.images,
  ...foreignMedia.images,
  ...wuDaoziMedia.images.map(({ files, processing, ...image }) => image),
];
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
const data = {
  version: 1,
  updatedAt: [foreign.updatedAt, wuDaozi.updatedAt].sort().at(-1),
  periods,
  artists,
  artworks,
  venues,
  holdings,
  topics,
  images,
};
await fs.writeFile("public/catalog.json", JSON.stringify(data));
console.log(
  `内容已生成：${artworks.length} 幅作品，${images.length} 张图像，${venues.length} 个收藏机构。`,
);
