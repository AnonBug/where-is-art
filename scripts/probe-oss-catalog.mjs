import fs from "node:fs/promises";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import sharp from "sharp";
import { parseCsv, imageColumns, mediaPath, ossBase } from "./lib/oss-csv.mjs";

const input = process.argv[2];
const full = process.argv.includes("--full");
assert.ok(input, "Usage: node scripts/probe-oss-catalog.mjs <csv>");
const rows = parseCsv(await fs.readFile(input, "utf8"));
const cachePath = "output/oss-catalog-import/media-probes.jsonl";
await fs.mkdir("output/oss-catalog-import", { recursive: true });
const cache = new Map();
try {
  for (const line of (await fs.readFile(cachePath, "utf8"))
    .split("\n")
    .filter(Boolean)) {
    const record = JSON.parse(line);
    cache.set(record.url, record);
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const files = [
  ...new Set(
    rows.flatMap((row) =>
      imageColumns
        .map((key) => row[key])
        .filter(Boolean)
        .map(mediaPath),
    ),
  ),
];
const queue = files.filter(
  (url) =>
    !cache.has(url) ||
    (full && !cache.get(url).sha256) ||
    cache.get(url)?.verification === "oss-etag",
);
let next = 0,
  checked = 0,
  bytesRead = 0;
const failures = [];
const log = await fs.open(cachePath, "a");
console.log(
  `OSS 图像核验：${files.length} 个文件，已缓存 ${files.length - queue.length} 个。`,
);
await Promise.all(
  Array.from({ length: 32 }, async () => {
    while (next < queue.length) {
      const url = queue[next++];
      let failure;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (!full) {
            const head = await fetch(ossBase + url, {
              method: "HEAD",
              signal: AbortSignal.timeout(20000),
            });
            assert.ok(head.ok, `HEAD HTTP ${head.status}`);
            assert.match(head.headers.get("content-type") ?? "", /^image\//);
            const etag = head.headers
              .get("etag")
              ?.replaceAll('"', "")
              .toLowerCase();
            const md5 = Buffer.from(
              head.headers.get("content-md5") ?? "",
              "base64",
            ).toString("hex");
            assert.match(
              md5,
              /^[a-f0-9]{32}$/,
              "Missing Content-MD5; explicit full verification required",
            );
            assert.equal(md5, etag, "Object checksum and ETag disagree");
            const previous = cache.get(url);
            if (previous) {
              assert.equal(
                md5,
                previous.md5,
                "Object changed since metadata inspection",
              );
              const record = {
                ...previous,
                md5,
                verification: "oss-content-md5",
              };
              await log.write(JSON.stringify(record) + "\n");
              cache.set(url, record);
              checked++;
              failure = undefined;
              break;
            }
            const response = await fetch(
              ossBase + url + "?x-oss-process=image/info",
              { signal: AbortSignal.timeout(20000) },
            );
            assert.ok(response.ok, `Image info HTTP ${response.status}`);
            const info = await response.json();
            const record = {
              url,
              bytes: Number(head.headers.get("content-length")),
              width: Number(info.ImageWidth?.value),
              height: Number(info.ImageHeight?.value),
              format: info.Format?.value,
              sha256: "",
              md5,
              verification: "oss-content-md5",
            };
            assert.equal(record.bytes, Number(info.FileSize?.value));
            assert.ok(record.width > 0 && record.height > 0);
            await log.write(JSON.stringify(record) + "\n");
            cache.set(url, record);
            checked++;
            if (checked % 300 === 0)
              console.log(
                `元数据已检查 ${checked}/${queue.length}，未下载图片正文`,
              );
            failure = undefined;
            break;
          }
          const response = await fetch(ossBase + url, {
            signal: AbortSignal.timeout(60000),
          });
          assert.ok(response.ok, `HTTP ${response.status}`);
          assert.match(response.headers.get("content-type") ?? "", /^image\//);
          const buffer = Buffer.from(await response.arrayBuffer());
          assert.equal(
            buffer.length,
            Number(response.headers.get("content-length")),
          );
          const meta = await sharp(buffer).metadata();
          assert.ok(meta.width > 0 && meta.height > 0);
          const hash = (name) =>
            crypto.createHash(name).update(buffer).digest("hex");
          const record = {
            url,
            bytes: buffer.length,
            width: meta.width,
            height: meta.height,
            format: meta.format,
            sha256: hash("sha256"),
            md5: hash("md5"),
          };
          const etag = response.headers
            .get("etag")
            ?.replaceAll('"', "")
            .toLowerCase();
          if (/^[a-f0-9]{32}$/.test(etag))
            assert.equal(record.md5, etag, "OSS ETag mismatch");
          await log.write(JSON.stringify(record) + "\n");
          cache.set(url, record);
          checked++;
          bytesRead += buffer.length;
          if (checked % 300 === 0)
            console.log(
              `已验证 ${checked}/${queue.length}，${(bytesRead / 1e6).toFixed(0)} MB`,
            );
          failure = undefined;
          break;
        } catch (error) {
          failure = error;
        }
      }
      if (failure) failures.push({ url, error: failure.message });
    }
  }),
);
await log.close();
await fs.writeFile(
  "output/oss-catalog-import/probe-result.json",
  JSON.stringify(
    {
      files: files.length,
      checked,
      bytesRead,
      fullHashFiles: [...cache.values()].filter((file) => file.sha256).length,
      metadataFiles: [...cache.values()].filter((file) => !file.sha256).length,
      failures,
    },
    null,
    2,
  ),
);
assert.equal(failures.length, 0, JSON.stringify(failures));
console.log(
  `OSS 检查完成：${files.length} 个文件可访问；像素尺寸、字节数和校验方式已记录。`,
);
