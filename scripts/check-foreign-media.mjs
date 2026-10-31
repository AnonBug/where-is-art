#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = async (file) =>
  JSON.parse(await fs.readFile(path.join(root, file), "utf8"));
const catalog = await read("content/foreign-catalog.json");
const { sources } = await read("content/foreign-sources.json");
const { images } = await read("content/foreign-media-manifest.json");
const publicCatalog = await read("public/catalog.json");
const ids = catalog.artworks.map((work) => work.id).sort();
assert.deepEqual(sources.map((s) => s.artworkId).sort(), ids);
assert.deepEqual(images.map((s) => s.artworkId).sort(), ids);
assert.deepEqual(
  (await fs.readdir(path.join(root, "public/media/foreign"))).sort(),
  ids,
  "Remove derivatives for works no longer in the corpus",
);
assert.ok(!JSON.stringify([catalog, sources, images]).includes("/Users/"));
let totalBytes = 0;
let largestImageBytes = 0;
sharp.concurrency(1);
sharp.cache({ memory: 16, items: 4, files: 4 });

for (const image of images) {
  assert.deepEqual(
    (
      await fs.readdir(path.join(root, "public/media/foreign", image.artworkId))
    ).sort(),
    ["detail.jpg", "preview.webp", "thumb.webp"],
  );
  const source = sources.find((s) => s.artworkId === image.artworkId);
  assert.equal(image.sourceHash, source.downloadSha256);
  assert.equal(image.sourceImageUrl, source.downloadUrl);
  assert.equal(image.sourceUrl, source.sourceUrl);
  assert.equal(image.publicationStatus, "cleared");
  assert.match(
    image.licenseUrl,
    /^https:\/\/creativecommons\.org\/publicdomain\//,
  );
  assert.equal(image.delivery.kind, "image");
  assert.ok(Math.max(image.width, image.height) <= 3840);
  assert.ok(
    image.width <= image.processing.sourceWidth &&
      image.height <= image.processing.sourceHeight,
  );
  assert.deepEqual(
    publicCatalog.images.find((s) => s.id === image.id),
    image,
    `Run content:build after changing ${image.id}`,
  );
  if (source.provider === "commons") {
    assert.equal(source.rightsEvidence.license, "Public domain");
    assert.equal(source.rightsEvidence.copyrighted, "False");
    if (
      !source.rightsEvidence.licenseTemplates.some((s) => s.startsWith("PD-"))
    ) {
      // Commons extmetadata can omit templates present on the file page.
      // Keep its raw values and require a separately recorded page review.
      const review = source.rightsEvidence.filePageReview;
      assert.ok(review, `Missing Commons license evidence: ${image.artworkId}`);
      assert.equal(review.url, source.sourceUrl);
      assert.match(review.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(review.countryOfOriginBasis.length > 20);
      assert.ok(review.unitedStatesBasis.length > 20);
      assert.equal(review.publicDomainMarkUrl, image.licenseUrl);
    }
  } else if (source.provider === "cleveland") {
    assert.equal(source.rightsEvidence.shareLicenseStatus, "CC0");
  } else {
    assert.equal(source.rightsEvidence.isPublicDomain, true);
  }
  for (const [resource, limit] of [
    [image.thumbnail, 100_000],
    [image.preview, 500_000],
    [image.delivery, 20_000_000],
  ]) {
    assert.ok(
      resource.url.startsWith(`media/foreign/${image.artworkId}/`) &&
        !resource.url.includes(".."),
    );
    const buffer = await fs.readFile(path.join(root, "public", resource.url));
    assert.equal(buffer.length, resource.bytes);
    assert.ok(buffer.length <= limit);
    assert.equal(
      crypto.createHash("sha256").update(buffer).digest("hex"),
      resource.sha256,
    );
    const { info } = await sharp(buffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(info.width, resource.width);
    assert.equal(info.height, resource.height);
    totalBytes += buffer.length;
  }
  largestImageBytes = Math.max(largestImageBytes, image.delivery.bytes);
}
console.log(
  JSON.stringify(
    {
      status: "passed",
      corpus: "western",
      artists: catalog.artists.length,
      artworks: ids.length,
      images: images.length,
      deployableBytes: totalBytes,
      largestImageBytes,
    },
    null,
    2,
  ),
);
