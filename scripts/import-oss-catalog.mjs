import fs from "node:fs/promises";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import { parseCsv, imageColumns, mediaPath } from "./lib/oss-csv.mjs";

const input = process.argv[2];
assert.ok(input, "Usage: node scripts/import-oss-catalog.mjs <csv>");
const read = async (path) => JSON.parse(await fs.readFile(path, "utf8"));
const save = (path, data) =>
  fs.writeFile(path, JSON.stringify(data, null, 2) + "\n");
const csv = await fs.readFile(input);
const rows = parseCsv(csv.toString("utf8"));
const hash = (text) => crypto.createHash("sha256").update(text).digest("hex");
const date = "2026-11-13";
const base = await read("public/catalog.json");
const index = await read("content/media-index.json");
const indexedFiles = new Map(index.files.map((file) => [file.url, file]));
// A repeat import replaces this batch rather than accumulating its own output.
let prior = { artworks: [], venues: [], holdings: [] };
let priorMedia = { images: [] };
try {
  prior = await read("content/oss-import-catalog.json");
  priorMedia = await read("content/oss-import-media-manifest.json");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const previousIds = new Set(prior.artworks.map((work) => work.id));
const existing = new Map(
  base.artworks
    .filter((work) => !previousIds.has(work.id))
    .map((work) => [work.id, work]),
);
const previousVenueIds = new Set(prior.venues.map((venue) => venue.id));
const oldVenues = base.venues.filter(
  (venue) => !previousVenueIds.has(venue.id),
);
const evidence = await read("output/oss-catalog-import/venue-evidence.json");
const research = await read("content/masters-research.json");
const probes = new Map(
  (await fs.readFile("output/oss-catalog-import/media-probes.jsonl", "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const row = JSON.parse(line);
      return [row.url, row];
    }),
);
const artistIds = {
  拉斐尔: "raphael",
  "爱德华·马奈": "manet",
  "克洛德·莫奈": "monet",
  "文森特·梵高": "van-gogh",
  "保罗·高更": "gauguin",
  "皮特·蒙德里安": "mondrian",
};
const normalize = (name) =>
  name
    .normalize("NFKC")
    .replace(/[_\s,，.·’'"()-]/g, "")
    .toLowerCase();
const qidToExisting = new Map(
  Object.entries(research.venues).map(([id, value]) => [value.qid, id]),
);
for (const venue of oldVenues) {
  const qid = venue.sourceUrl.match(/wikidata\.org\/wiki\/(Q\d+)/)?.[1];
  if (qid) qidToExisting.set(qid, venue.id);
}
for (const entity of Object.values(evidence.collections)) {
  if (qidToExisting.has(entity.id)) continue;
  const labels = new Set(entity.labels.map(normalize));
  const candidates = oldVenues.filter((venue) => {
    if (!venue.coordinates || !entity.coordinates) return false;
    if (
      Math.hypot(
        ...venue.coordinates.map((value, i) => value - entity.coordinates[i]),
      ) > 0.025
    )
      return false;
    const title = decodeURIComponent(
      (venue.coordinateSourceUrl ?? "").split("/wiki/")[1] ?? "",
    );
    return (
      labels.has(normalize(venue.name)) ||
      (title && labels.has(normalize(title)))
    );
  });
  if (candidates.length === 1) qidToExisting.set(entity.id, candidates[0].id);
}
const artworks = [],
  images = [],
  holdings = [],
  records = [];
const venues = new Map(),
  counts = {};
const publicVenue = (entity) =>
  entity.coordinates &&
  !entity.types.includes("Q5") &&
  !/private collection|art dealer|art collector|former .*gallery|defunct|headquarters/i.test(
    entity.description,
  ) &&
  /museum|gallery|palace|church|cathedral|library|art institute|chapel|basilica|abbey|cultural institution|art foundation/i.test(
    entity.description,
  );
const neverMap = (text) =>
  /private|unknown|私人|私藏|待核|失窃|被盗|毁失|焚毁|已毁|destroyed|stolen|lost painting/i.test(
    text,
  );
const ambiguousName = (text) =>
  /^(?:国家美术馆|国家艺术馆|画廊|美术馆|博物馆|National Gallery|National Museum)$/i.test(
    text,
  );
function collectionFor(row) {
  const name = row["收藏索引"].trim();
  if (!name) return undefined;
  const labels = name.split("；").map(normalize);
  const qids = evidence.works[row["作品ID"]]?.collections ?? [];
  const candidates = qids
    .map((qid) => evidence.collections[qid])
    .filter(
      (entity) =>
        entity &&
        entity.labels.some((label) => labels.includes(normalize(label))),
    );
  const institutions = candidates.filter((entity) => publicVenue(entity));
  // Multiple collections and destruction/loss notes remain an unlocated index
  // entry. A museum's coordinates never establish the work's current location.
  const allowMap = labels.length === 1 && !neverMap(name + " " + row["说明"]);
  if (allowMap && institutions.length === 1) {
    const entity = institutions[0];
    if (qidToExisting.has(entity.id)) return qidToExisting.get(entity.id);
    const id = `oss-venue-${entity.id.toLowerCase()}`;
    venues.set(id, {
      id,
      name: entity.name,
      city: entity.city,
      country: entity.country,
      coordinates: entity.coordinates,
      sourceUrl: `https://www.wikidata.org/wiki/${entity.id}`,
      coordinateNote:
        "CSV 所列收藏机构的参考位置，不代表具体展厅、实时展出或作品当前位置。",
    });
    return id;
  }
  if (allowMap && !ambiguousName(name)) {
    const matching = oldVenues.filter(
      (venue) => normalize(venue.name) === normalize(name),
    );
    if (matching.length === 1) return matching[0].id;
  }
  const id = `oss-collection-${hash(name).slice(0, 16)}`;
  const sourceUrl =
    candidates.length === 1
      ? `https://www.wikidata.org/wiki/${candidates[0].id}`
      : row["作品来源"];
  venues.set(id, {
    id,
    name,
    city: "位置待核实",
    country: "国家待核实",
    coordinates: null,
    sourceUrl,
    coordinateNote:
      "保留原始收藏索引；私人收藏、多重声明或位置尚未核实，不在地图标点。",
  });
  return id;
}
function resource(url) {
  const path = mediaPath(url),
    probe = probes.get(path);
  assert.ok(probe, `Run probe-oss-catalog first: ${path}`);
  const indexed = indexedFiles.get(path);
  const previousHash =
    indexed?.md5 === probe.md5 && indexed?.bytes === probe.bytes
      ? indexed.sha256
      : "";
  return {
    url: path,
    width: probe.width,
    height: probe.height,
    bytes: probe.bytes,
    sha256: probe.sha256 || previousHash,
    md5: probe.md5,
  };
}
for (const row of rows) {
  const id = row["作品ID"],
    artistId = artistIds[row["画家"]];
  assert.ok(
    artistId && base.artists.some((artist) => artist.id === artistId),
    `Unknown artist: ${row["画家"]}`,
  );
  const urls = imageColumns.map((key) => row[key]);
  assert.ok(
    urls.every(Boolean) || urls.every((url) => !url),
    `Incomplete image URLs: ${id}`,
  );
  const hasImage = urls.every(Boolean),
    reused = existing.has(id);
  counts[artistId] ??= {
    artist: row["画家"],
    total: 0,
    withImage: 0,
    reused: 0,
    added: 0,
  };
  const count = counts[artistId];
  count.total++;
  count.withImage += Number(hasImage);
  count.reused += Number(reused);
  count.added += Number(!reused);
  records.push({
    artworkId: id,
    artistId,
    reused,
    wikidataId: row["Wikidata QID"],
    wikidataRevision: row["索引修订号"],
    originalTitle: row["原题"],
    catalogNumber: row["目录编号"],
    inventoryNumber: row["馆藏号"],
    collectionIndex: row["收藏索引"],
    status: row["状态"],
    catalogReview: row["目录核对状态"],
    suppliedGuideScope: row["导读类型"],
    imageAvailable: hasImage,
    sourceUrl: row["作品来源"],
    note: row["说明"],
  });
  if (reused) {
    const old = base.images.find(
      (image) =>
        image.artworkId === id && ["whole", "reference"].includes(image.role),
    );
    assert.ok(old && hasImage, `Existing image would be removed: ${id}`);
    assert.deepEqual(
      [old.thumbnail.url, old.preview.url, old.delivery.url],
      urls.map(mediaPath),
      `Existing image changed: ${id}`,
    );
    for (const url of urls.map(mediaPath)) {
      assert.equal(
        probes.get(url)?.md5,
        indexedFiles.get(url)?.md5,
        `Existing OSS content changed: ${url}`,
      );
    }
    continue;
  }
  const sourceUrl =
    row["作品来源"] || `https://www.wikidata.org/wiki/${row["Wikidata QID"]}`;
  assert.match(sourceUrl, /^https?:\/\//, `Missing source: ${id}`);
  const note = [
    row["说明"],
    row["收藏索引"] && `目录所列收藏：${row["收藏索引"]}。`,
    row["目录核对状态"] && `目录核对：${row["目录核对状态"]}。`,
    !hasImage && `暂无可用图像：${row["状态"]}。`,
  ]
    .filter(Boolean)
    .join(" ");
  const work = {
    id,
    title: row["作品名称"],
    artistIds: [artistId],
    dateLabel: row["年代"] || "年代待核实",
    medium: row["媒材"] || "媒材待核实",
    description:
      row["原题"] && row["原题"] !== row["作品名称"]
        ? `原题：${row["原题"]}。`
        : "",
    sourceUrl,
    note,
  };
  if (!hasImage) work.imageStatus = "unavailable";
  // The CSV does not contain individual essays. Do not infer iconography from
  // the artist (e.g. Mondrian's early figurative work is not all abstraction).
  work.guide = {
    scope: "contextual",
    scopeNote:
      "依据本次作品目录提供编目信息与通用观看提示；本作具体创作背景、人物身份和题材解读仍待核实。",
    background: `《${work.title}》在本次目录中归入${row["画家"]}，年代记为${work.dateLabel}，媒材为${work.medium}。${work.description}${row["目录编号"] ? `目录编号：${row["目录编号"]}。` : ""}${row["馆藏号"] ? `馆藏号：${row["馆藏号"]}。` : ""}归属、年代和名称沿用所提供目录；如来源保留疑问，应结合原始编目阅读。`,
    story: `现有资料主要提供题名、年代、媒材与收藏索引，尚不足以确认这件作品的具体委托、人物身份或创作缘起。同名作品可能存在不同版本，可用题名、馆藏号与来源页面交叉辨认，再结合可靠的作品研究理解画中内容。${row["说明"]}`,
    looking: [
      ...(hasImage
        ? []
        : [
            "本条目暂无可用图像；请先在资料来源中确认对应作品，以下提示不构成对画面细节的描述。",
          ]),
      "先看整个画幅，留意目光最先停留的位置，再比较主要形状、明暗和色彩的分布。哪些关系让画面显得平衡，哪些带来变化？",
      "从全幅切换到局部，观察边缘、表面和笔触，再回到整体比较这些细节如何影响观看。图像的裁切、拍摄光线与分辨率也会影响屏幕上的观感。",
    ],
    sources: [{ label: "本作编目资料", url: sourceUrl }],
  };
  artworks.push(work);
  const venueId = collectionFor(row);
  if (venueId)
    holdings.push({
      artworkId: id,
      venueId,
      note:
        "CSV 收藏索引；不代表实时展出或作品当前位置。" +
        (row["说明"] ? ` ${row["说明"]}` : ""),
      verifiedAt: date,
      sourceUrl,
    });
  if (hasImage) {
    assert.ok(
      ["cleared", "review-required"].includes(row["发布状态"]),
      `Unknown publication status: ${id}`,
    );
    assert.ok(
      ["whole", "reference"].includes(row["图像角色"]),
      `Unknown image role: ${id}`,
    );
    const [thumbnail, preview, detail] = urls.map(resource);
    assert.ok(
      thumbnail.bytes <= 100_000 &&
        preview.bytes <= 500_000 &&
        detail.bytes <= 20_000_000,
      `Image exceeds contract: ${id}`,
    );
    images.push({
      id: `${id}-${row["图像角色"]}`,
      artworkId: id,
      role: row["图像角色"],
      label: row["图像角色"] === "reference" ? "参考图" : "全图",
      order: 0,
      width: detail.width,
      height: detail.height,
      thumbnail,
      preview,
      delivery: { kind: "image", format: "jpeg", ...detail },
      sourceUrl: row["图像来源"],
      sourceImageUrl: "",
      sourceHash: "",
      credit: row["署名"],
      licenseLabel: row["图像许可"],
      licenseUrl: row["许可地址"],
      quality:
        Math.max(detail.width, detail.height) >= 2000 ? "high" : "standard",
      publicationStatus: row["发布状态"],
      processing: {
        profile: "user-supplied-oss-csv",
        note: "直接引用已上传的网页资源；尺寸与字节数已检查。SHA-256 非空表示已下载校验；为空时 MD5 来自 OSS 的 Content-MD5 响应头并已与 ETag 对照。CSV 未提供原始下载地址及源图 SHA-256，保留为空。",
      },
    });
  }
}
const previousUrls = new Set(
  priorMedia.images.flatMap((image) => [
    image.thumbnail.url,
    image.preview.url,
    image.delivery.url,
  ]),
);
const files = new Map(
  index.files
    .filter((file) => !previousUrls.has(file.url))
    .map((file) => [file.url, file]),
);
for (const image of images)
  for (const resource of [image.thumbnail, image.preview, image.delivery]) {
    const { url, bytes, md5, verification } = probes.get(resource.url);
    const sha256 = resource.sha256;
    files.set(url, {
      url,
      bytes,
      sha256,
      md5,
      ...(!sha256 && verification ? { verification } : {}),
    });
  }
await fs.mkdir("content/imports", { recursive: true });
if (
  path.resolve(input) !==
  path.resolve("content/imports/oss-catalog-2026-11-13.csv")
)
  await fs.copyFile(input, "content/imports/oss-catalog-2026-11-13.csv");
await save("content/oss-import-catalog.json", {
  version: 1,
  updatedAt: date,
  artworks,
  venues: [...venues.values()],
  holdings,
});
await save("content/oss-import-media-manifest.json", {
  version: 1,
  updatedAt: date,
  images,
});
await save("content/oss-import-research.json", {
  version: 1,
  updatedAt: date,
  sourceFile: "imports/oss-catalog-2026-11-13.csv",
  sourceSha256: hash(csv),
  counts,
  records,
  collectionEvidence: evidence,
});
await save("content/media-index.json", {
  ...index,
  updatedAt: date,
  files: [...files.values()].sort((a, b) =>
    a.url < b.url ? -1 : a.url > b.url ? 1 : 0,
  ),
});
console.log(
  JSON.stringify(
    {
      artworks: artworks.length,
      images: images.length,
      venues: venues.size,
      holdings: holdings.length,
      counts,
    },
    null,
    2,
  ),
);
