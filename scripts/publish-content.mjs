import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { gzipSync } from "node:zlib";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { loadEnv } from "vite";
import { buildContentDelivery } from "./build-content-delivery.mjs";

const env = { ...loadEnv("production", process.cwd()), ...process.env };
const base = new URL(
  `${(env.VITE_CONTENT_BASE_URL ?? "").replace(/\/+$/, "")}/`,
);
assert.equal(base.protocol, "https:");
assert(
  !base.search && !base.hash,
  "Content base must not contain query/fragment",
);
const root = "output/content-release";
const digest = (bytes, algorithm = "sha256") =>
  crypto.createHash(algorithm).update(bytes).digest("hex");
const mode = process.argv[2];
assert(
  ["--prepare", "--publish", "--verify"].includes(mode),
  "Use --prepare, --publish, or --verify [--expected-local]",
);

async function get(url, options = {}) {
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return response;
    } catch (cause) {
      error = cause;
    }
  }
  throw error;
}

async function verifyCurrent(expectedRevision) {
  const pointerResponse = await get(new URL("current.json", base), {
    cache: "no-cache",
  });
  const pointer = await pointerResponse.json();
  assert.equal(pointer.schemaVersion, 1);
  assert.match(pointer.revision, /^[a-f0-9]{20}$/);
  assert.equal(
    pointer.index,
    `releases/${pointer.revision}/catalog-index.json`,
  );
  if (expectedRevision)
    assert.equal(
      pointer.revision,
      expectedRevision,
      "Publish this catalog to OSS before deploying the app",
    );
  const indexUrl = new URL(pointer.index, base);
  const bytes = Buffer.from(await (await get(indexUrl)).arrayBuffer());
  assert.equal(digest(bytes), pointer.indexSha256);
  const index = JSON.parse(bytes);
  assert.equal(index.detailBase, `artwork-details/${pointer.revision}/`);
  assert.equal(index.artworks.length, pointer.artworkCount);
  for (const origin of ["https://anonbug.github.io", "http://127.0.0.1:8775"]) {
    for (const url of [
      new URL("current.json", base),
      indexUrl,
      new URL(`${index.detailBase}${index.artworks[0].id}.json`, indexUrl),
    ]) {
      const response = await get(url, {
        method: "HEAD",
        headers: { Origin: origin },
      });
      assert(
        [origin, "*"].includes(
          response.headers.get("access-control-allow-origin"),
        ),
        `CORS missing: ${url}`,
      );
    }
  }
  const first = await (
    await get(
      new URL(`${index.detailBase}${index.artworks[0].id}.json`, indexUrl),
    )
  ).json();
  assert.equal(first.work.id, index.artworks[0].id);
  console.log(
    `OSS 当前版本 ${pointer.revision}：${index.artworks.length} 件作品，入口、索引、详情和生产/本地 CORS 通过。`,
  );
  return pointer;
}

if (mode === "--verify") {
  const local = process.argv.includes("--expected-local")
    ? JSON.parse(
        await fs.readFile("public/catalog-index.json", "utf8"),
      ).detailBase.split("/")[1]
    : undefined;
  await verifyCurrent(local);
} else {
  const data = JSON.parse(await fs.readFile("public/catalog.json", "utf8"));
  const { revision, index } = await buildContentDelivery(data);
  const releaseDirectory = path.join(root, "releases", revision);
  const compressedDirectory = path.join(root, "gzip", revision);
  await fs.mkdir(releaseDirectory, { recursive: true });
  await fs.mkdir(compressedDirectory, { recursive: true });
  const files = [];
  async function add(relative, bytes) {
    const compressed = gzipSync(bytes, { level: 9 });
    for (const [directory, value] of [
      [releaseDirectory, bytes],
      [compressedDirectory, compressed],
    ]) {
      const target = path.join(directory, relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, value);
    }
    files.push({
      path: relative,
      bytes: bytes.length,
      sha256: digest(bytes),
      gzipBytes: compressed.length,
      gzipMd5: digest(compressed, "md5"),
    });
  }
  await add(
    "catalog-index.json",
    await fs.readFile("public/catalog-index.json"),
  );
  await add("catalog.json", Buffer.from(JSON.stringify(data)));
  // Keep known source references and actual serving files distinct. A source URL
  // is not proof of an archived original or the source's maximum resolution.
  await add(
    "image-manifest.json",
    Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        revision,
        relativePathsUse: "VITE_ASSET_BASE_URL",
        artworks: data.artworks.map(({ id }) => ({
          artworkId: id,
          imageIds: data.images
            .filter((image) => image.artworkId === id)
            .map(({ id }) => id),
        })),
        images: data.images,
      }),
    ),
  );
  for (const { id } of data.artworks) {
    const relative = `${index.detailBase}${id}.json`;
    await add(relative, await fs.readFile(path.join("public", relative)));
  }
  const pointer = {
    schemaVersion: 1,
    revision,
    index: `releases/${revision}/catalog-index.json`,
    catalog: `releases/${revision}/catalog.json`,
    images: `releases/${revision}/image-manifest.json`,
    indexSha256: files.find((file) => file.path === "catalog-index.json")
      .sha256,
    artworkCount: data.artworks.length,
    imageCount: data.images.length,
  };
  await fs.writeFile(path.join(root, "current.json"), JSON.stringify(pointer));
  await fs.writeFile(
    path.join(root, `${revision}-verification.json`),
    JSON.stringify({ revision, files }, null, 2),
  );
  console.log(
    `准备 ${files.length} 个 JSON；gzip 合计 ${(files.reduce((sum, file) => sum + file.gzipBytes, 0) / 1e6).toFixed(2)} MB。`,
  );
  if (mode === "--publish") {
    const match = base.hostname.match(
      /^([a-z0-9-]+)\.oss-([a-z0-9-]+)\.aliyuncs\.com$/,
    );
    assert(
      match,
      "Publisher requires an OSS bucket endpoint, not a custom domain",
    );
    const [, bucket, region] = match;
    const destination = `oss://${bucket}${base.pathname}`;
    async function upload(source, target, immutable) {
      const args = [
        "ossutil",
        "cp",
        source,
        target,
        "--region",
        region,
        "--content-type",
        "application/json; charset=utf-8",
        "--cache-control",
        immutable
          ? "public,max-age=31536000,immutable"
          : "no-cache,max-age=0,must-revalidate",
        "--no-progress",
        "--force",
        "--output-dir",
        path.join(root, "ossutil-output"),
      ];
      if (immutable)
        args.push(
          "--recursive",
          "--ignore-existing",
          "--job",
          "12",
          "--content-encoding",
          "gzip",
        );
      await new Promise((resolve, reject) => {
        const child = spawn("aliyun", args, { stdio: "inherit" });
        child.on("error", reject);
        child.on("exit", (code) =>
          code === 0
            ? resolve()
            : reject(new Error(`OSS upload exited ${code}`)),
        );
      });
    }
    // Never remove or overwrite immutable versions. A retry fills missing files.
    await upload(
      `${compressedDirectory}/`,
      `${destination}releases/${revision}/`,
      true,
    );
    let next = 0,
      checked = 0;
    await Promise.all(
      Array.from({ length: 16 }, async () => {
        while (next < files.length) {
          const file = files[next++];
          const response = await get(
            new URL(`releases/${revision}/${file.path}`, base),
            { method: "HEAD" },
          );
          assert.equal(
            Number(response.headers.get("content-length")),
            file.gzipBytes,
            file.path,
          );
          assert.equal(
            response.headers.get("etag")?.replaceAll('"', "").toLowerCase(),
            file.gzipMd5,
            file.path,
          );
          assert.equal(
            response.headers.get("content-encoding"),
            "gzip",
            file.path,
          );
          assert(
            response.headers.get("cache-control")?.includes("immutable"),
            file.path,
          );
          if (++checked % 500 === 0)
            console.log(
              `已核验 ${checked}/${files.length} 个远程 JSON（HEAD，无图片下载）。`,
            );
        }
      }),
    );
    // Verify actual decoding before committing the public pointer.
    const remoteIndex = Buffer.from(
      await (await get(new URL(pointer.index, base))).arrayBuffer(),
    );
    assert.equal(digest(remoteIndex), pointer.indexSha256);
    const firstUrl = new URL(
      `${index.detailBase}${index.artworks[0].id}.json`,
      new URL(pointer.index, base),
    );
    assert.equal(
      (await (await get(firstUrl)).json()).work.id,
      index.artworks[0].id,
    );
    for (const origin of [
      "https://anonbug.github.io",
      "http://127.0.0.1:8775",
    ]) {
      for (const url of [new URL(pointer.index, base), firstUrl]) {
        const response = await get(url, {
          method: "HEAD",
          headers: { Origin: origin },
        });
        assert(
          [origin, "*"].includes(
            response.headers.get("access-control-allow-origin"),
          ),
          `CORS missing: ${url}`,
        );
      }
    }
    const old = await fetch(new URL("current.json", base), {
      cache: "no-cache",
      signal: AbortSignal.timeout(30_000),
    });
    if (old.ok)
      await fs.writeFile(
        path.join(root, `previous-current-${Date.now()}.json`),
        await old.text(),
      );
    else
      assert.equal(
        old.status,
        404,
        "Cannot read previous pointer; refusing to activate release",
      );
    // This is the only mutable object, updated after all files have been checked.
    await upload(
      path.join(root, "current.json"),
      `${destination}current.json`,
      false,
    );
    await verifyCurrent(revision);
    console.log(`已发布：${new URL("current.json", base).href}`);
  }
}
