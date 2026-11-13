import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { parseCsv, mediaPath, ossBase } from "./lib/oss-csv.mjs";
import { validateFiles } from "./lib/media-index.mjs";

// Local references only. Never upload media or fall back to fetching image bodies.
const [input, fullInput, flag] = process.argv.slice(2);
assert.ok(
  input && fullInput && (!flag || flag === "--apply"),
  "Usage: node scripts/update-oss-images.mjs <replacement.csv> <full-catalog.csv> [--apply]",
);
const read = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const save = (file, value) =>
  fs.writeFile(file, JSON.stringify(value, null, 2) + "\n");
const csv = await fs.readFile(input);
const rows = parseCsv(csv.toString("utf8"));
const full = new Map(
  parseCsv(await fs.readFile(fullInput, "utf8")).map((row) => [
    row["作品ID"],
    row,
  ]),
);
const catalog = await read("public/catalog.json");
const manifestNames = (await fs.readdir("content")).filter((name) =>
  name.endsWith("media-manifest.json"),
);
const manifests = await Promise.all(
  manifestNames.map(async (name) => ({
    name,
    data: await read(`content/${name}`),
  })),
);
const index = await read("content/media-index.json");
const absolute = (url) => (url.startsWith("https:") ? url : ossBase + url);
const relative = (url) => (url.startsWith(ossBase) ? mediaPath(url) : url);
const columns = {
  delivery: "当前完整图",
  preview: "预览图",
  thumbnail: "缩略图",
};
const report = {
  checkedAt: new Date().toISOString(),
  applied: false,
  records: rows.length,
  matched: 0,
  changed: 0,
  alreadyCurrent: 0,
  duplicates: 0,
  unmatched: [],
  conflicts: [],
  errors: [],
  artists: {},
  headChecked: 0,
  imageInfoChecked: 0,
  imageBodyDownloads: 0,
  works: [],
};
const pending = [];
for (const row of rows) {
  const id = row["作品ID"];
  const works = catalog.artworks.filter((work) => work.id === id);
  const matches = manifests.flatMap((manifest) =>
    manifest.data.images
      .filter(
        (image) =>
          image.artworkId === id && ["whole", "reference"].includes(image.role),
      )
      .map((image) => ({ manifest, image })),
  );
  if (works.length !== 1 || matches.length !== 1) {
    report.unmatched.push({
      id,
      reason: `作品匹配 ${works.length}，主图匹配 ${matches.length}`,
    });
    continue;
  }
  report.matched++;
  report.artists[row["画家"]] = (report.artists[row["画家"]] ?? 0) + 1;
  const { manifest, image } = matches[0];
  const detail = {
    id,
    artist: row["画家"],
    before: structuredClone(image),
    resources: {},
  };
  report.works.push(detail);
  const original = full.get(id);
  if (
    !original ||
    original["完整图 OSS 链接"] !== row["旧完整图"] ||
    !works[0].artistIds.includes(row["画家"])
  ) {
    report.conflicts.push({
      id,
      reason: "完整目录的 ID、旧完整图或画家交叉核对不一致",
    });
    continue;
  }
  for (const [kind, column] of Object.entries(columns)) {
    const resourcePath = mediaPath(row[column]);
    const filename =
      kind === "delivery"
        ? "detail.jpg"
        : kind === "preview"
          ? "preview.webp"
          : "thumb.webp";
    assert.equal(resourcePath.split("/").at(-1), filename, `${id}: ${column}`);
    assert.ok(
      resourcePath.startsWith(`media/masters/${id}/`),
      `${id}: mismatched URL identity`,
    );
    assert.equal(
      path.posix.dirname(resourcePath),
      path.posix.dirname(mediaPath(row["当前完整图"])),
      `${id}: mixed versions`,
    );
  }
  const current = absolute(image.delivery.url);
  if (current === row["当前完整图"]) {
    if (
      Object.entries(columns).every(
        ([kind, column]) => absolute(image[kind].url) === row[column],
      )
    ) {
      report.alreadyCurrent++;
      detail.status = "already-current";
    } else
      report.conflicts.push({
        id,
        reason: "已使用新版全图，但预览图或缩略图属于其他版本",
      });
    continue;
  }
  if (current !== row["旧完整图"]) {
    report.conflicts.push({
      id,
      reason: "当前全图既不是清单旧版也不是新版，需先核对来源及尺寸",
      current,
      source: image.sourceUrl,
      width: image.width,
      height: image.height,
    });
    continue;
  }
  assert.equal(
    image.delivery.kind,
    "image",
    `${id}: unexpected DZI replacement`,
  );
  pending.push({ row, manifest, image, detail });
}

async function request(url, method) {
  let failure;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
      assert.equal(
        response.status,
        200,
        `${method} ${response.status}: ${url}`,
      );
      return response;
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}
async function probe(url) {
  const head = await request(url, "HEAD");
  report.headChecked++;
  const bytes = Number(head.headers.get("content-length"));
  const md5 = Buffer.from(
    head.headers.get("content-md5") ?? "",
    "base64",
  ).toString("hex");
  assert.match(md5, /^[a-f0-9]{32}$/, `Missing Content-MD5: ${url}`);
  assert.equal(
    head.headers.get("etag")?.replaceAll('"', "").toLowerCase(),
    md5,
    `ETag mismatch: ${url}`,
  );
  assert.match(head.headers.get("content-type") ?? "", /^image\//);
  // Attachment is expected on the default OSS domain and does not prevent <img>.
  const response = await request(url + "?x-oss-process=image/info", "GET");
  assert.match(response.headers.get("content-type") ?? "", /json/);
  const info = await response.json();
  report.imageInfoChecked++;
  const width = Number(info.ImageWidth?.value),
    height = Number(info.ImageHeight?.value);
  assert.ok(width > 0 && height > 0 && bytes > 0, `Invalid metadata: ${url}`);
  assert.equal(
    Number(info.FileSize?.value),
    bytes,
    `HEAD / image-info mismatch: ${url}`,
  );
  return { url, width, height, bytes, sha256: "", md5 };
}
let next = 0;
const jobs = report.works.flatMap((detail) => {
  const row = rows.find((row) => row["作品ID"] === detail.id);
  return Object.entries(columns).map(([kind, column]) => ({
    detail,
    kind,
    url: row[column],
  }));
});
await Promise.all(
  Array.from({ length: 12 }, async () => {
    while (next < jobs.length) {
      const { detail, kind, url } = jobs[next++];
      try {
        detail.resources[kind] = await probe(url);
      } catch (error) {
        report.errors.push({ id: detail.id, url, reason: error.message });
      }
    }
  }),
);
for (const item of pending) {
  const { row, image, detail } = item;
  const { delivery, preview, thumbnail } = detail.resources;
  if (!delivery || !preview || !thumbnail) continue;
  try {
    assert.equal(
      `${delivery.width}×${delivery.height}`,
      row["当前尺寸"],
      "新全图尺寸与清单不一致",
    );
    assert.equal(
      delivery.bytes,
      Number(row["当前字节"]),
      "新全图字节与清单不一致",
    );
    assert.ok(
      delivery.width * delivery.height >= image.width * image.height &&
        Math.max(delivery.width, delivery.height) >=
          Math.max(image.width, image.height),
      "新版本像素减少，需复核",
    );
    assert.ok(
      delivery.bytes <= 20_000_000 &&
        preview.bytes <= 500_000 &&
        thumbnail.bytes <= 100_000,
      "资源超过现有加载预算",
    );
    assert.ok(
      preview.width <= delivery.width && preview.height <= delivery.height,
      "预览图大于全图",
    );
    assert.ok(
      Math.abs(
        preview.width / preview.height - delivery.width / delivery.height,
      ) < 0.01,
      "预览图与全图比例不一致",
    );
    // Preserve supplied provenance links, including legacy HTTP license URLs.
    // Only the three displayed/downloaded OSS images must use the exact HTTPS URLs.
    for (const key of ["来源文件页", "原始来源地址", "许可地址"])
      assert.match(new URL(row[key]).protocol, /^https?:$/);
    assert.ok(row["署名"] && row["许可"] && row["使用条件"], "缺少许可或署名");
    detail.status = "ready";
  } catch (error) {
    report.conflicts.push({ id: detail.id, reason: error.message });
  }
}
const destination = "content/imports/oss-image-upgrades-2026-11-13.csv";
if (
  flag === "--apply" &&
  !report.unmatched.length &&
  !report.conflicts.length &&
  !report.errors.length
) {
  const removed = new Set(),
    changedManifests = new Set();
  for (const { row, image, manifest, detail } of pending) {
    assert.equal(detail.status, "ready");
    for (const kind of Object.keys(columns))
      removed.add(relative(image[kind].url));
    const { delivery, preview, thumbnail } = detail.resources;
    Object.assign(image, {
      width: delivery.width,
      height: delivery.height,
      thumbnail,
      preview,
      delivery: { kind: "image", format: "jpeg", ...delivery },
      sourceUrl: row["来源文件页"],
      sourceImageUrl: row["原始来源地址"],
      sourceHash: "",
      credit: row["署名"],
      licenseLabel: row["许可"],
      licenseUrl: row["许可地址"],
      usageTerms: row["使用条件"],
      quality:
        Math.max(delivery.width, delivery.height) >= 2000 ? "high" : "standard",
      processing: {
        profile: "user-supplied-oss-image-upgrade",
        sourceFile: destination.replace(/^content\//, ""),
        note: "按作品 ID 更新网页资源；匿名 HEAD 与 image/info 核对尺寸、字节及 Content-MD5 / ETag。未下载图片正文，未计算 SHA-256；不保证为馆方最高分辨率原件。",
      },
    });
    changedManifests.add(manifest);
    detail.status = "updated";
    report.changed++;
  }
  const used = new Set(
    manifests.flatMap(({ data }) =>
      data.images.flatMap((image) =>
        [image.thumbnail, image.preview, image.delivery].map((resource) =>
          relative(resource.url),
        ),
      ),
    ),
  );
  const files = new Map(
    index.files
      .filter((file) => !removed.has(file.url) || used.has(file.url))
      .map((file) => [file.url, file]),
  );
  for (const { detail } of pending)
    for (const resource of Object.values(detail.resources)) {
      const { bytes, md5 } = resource,
        url = mediaPath(resource.url);
      files.set(url, {
        url,
        bytes,
        sha256: "",
        md5,
        verification: "oss-content-md5",
      });
    }
  index.files = [...files.values()].sort((a, b) =>
    a.url < b.url ? -1 : a.url > b.url ? 1 : 0,
  );
  validateFiles(index.files);
  for (const { name, data } of changedManifests)
    await save(`content/${name}`, data);
  if (pending.length) {
    await save("content/media-index.json", index);
    await fs.writeFile(destination, csv);
  }
  report.applied = true;
}
await fs.mkdir("output/hd-image-update", { recursive: true });
await save("output/hd-image-update/update-report.json", report);
const { works, ...summary } = report;
console.log(JSON.stringify(summary, null, 2));
if (report.unmatched.length || report.conflicts.length || report.errors.length)
  process.exitCode = 1;
