import fs from "node:fs/promises";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { loadEnv } from "vite";
import {
  atlasSchema,
  catalogIndexSchema,
  artworkContentSchema,
  validateRelations,
} from "../src/domain/atlas.ts";
import {
  contentRevision,
  createCatalogIndex,
} from "./build-content-delivery.mjs";

const sha256 = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
async function getBytes(url) {
  const response = await fetch(url, {
    cache: "no-cache",
    signal: AbortSignal.timeout(30_000),
  });
  assert.ok(response.ok, `Content request failed: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function checkAppContent({
  base,
  localCatalog,
  localIndex,
  get = getBytes,
}) {
  // App builds omit content JSON. Require their content snapshot to have been
  // uploaded, while allowing a newer, compatible release to remain live.
  const revision = contentRevision(localCatalog);
  assert.deepEqual(JSON.parse(localIndex), createCatalogIndex(localCatalog));
  const published = await get(
    new URL(`releases/${revision}/catalog-index.json`, base),
  );
  assert.equal(
    sha256(published),
    sha256(localIndex),
    "Local content must be published before deploying the app",
  );

  // Pin this verification to one immutable release even if current.json moves.
  const pointer = JSON.parse(await get(new URL("current.json", base)));
  assert.equal(pointer.schemaVersion, 1);
  assert.match(pointer.revision, /^[a-f0-9]{20}$/);
  assert.equal(
    pointer.index,
    `releases/${pointer.revision}/catalog-index.json`,
  );
  assert.equal(pointer.catalog, `releases/${pointer.revision}/catalog.json`);
  const indexBytes = await get(new URL(pointer.index, base));
  assert.equal(sha256(indexBytes), pointer.indexSha256);
  const index = catalogIndexSchema.parse(JSON.parse(indexBytes));
  const raw = JSON.parse(await get(new URL(pointer.catalog, base)));
  assert.equal(
    contentRevision(raw),
    pointer.revision,
    "Published catalog revision mismatch",
  );
  const catalog = atlasSchema.parse(raw);
  assert.deepEqual(
    validateRelations(catalog),
    [],
    "Published content has invalid references",
  );
  assert.deepEqual(
    JSON.parse(indexBytes),
    createCatalogIndex(raw),
    "Published index and catalog differ",
  );
  assert.equal(catalog.artworks.length, pointer.artworkCount);
  assert.equal(catalog.images.length, pointer.imageCount);
  const first = catalog.artworks[0];
  assert.ok(first, "Published catalog must contain artworks");
  const detail = artworkContentSchema.parse(
    JSON.parse(
      await get(
        new URL(
          `${index.detailBase}${first.id}.json`,
          new URL(pointer.index, base),
        ),
      ),
    ),
  );
  assert.deepEqual(detail.work, first);
  assert.deepEqual(
    detail.images,
    catalog.images.filter((image) => image.artworkId === first.id),
  );
  return {
    localRevision: revision,
    currentRevision: pointer.revision,
    artworkCount: catalog.artworks.length,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  // Retain the existing remote availability, index checksum and CORS checks.
  execFileSync(process.execPath, ["scripts/publish-content.mjs", "--verify"], {
    stdio: "inherit",
  });
  const env = { ...loadEnv("production", process.cwd()), ...process.env };
  const base = new URL(`${env.VITE_CONTENT_BASE_URL.replace(/\/+$/, "")}/`);
  assert.equal(base.protocol, "https:");
  const result = await checkAppContent({
    base,
    localCatalog: JSON.parse(await fs.readFile("public/catalog.json", "utf8")),
    localIndex: await fs.readFile("public/catalog-index.json"),
  });
  console.log(
    `前端发布检查通过：仓库内容 ${result.localRevision} 已上传；线上内容 ${result.currentRevision}（${result.artworkCount} 件作品）与当前前端兼容。`,
  );
}
