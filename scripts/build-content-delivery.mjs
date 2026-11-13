import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

export async function buildContentDelivery(data, publicRoot = "public") {
  const revision = crypto
    .createHash("sha256")
    .update("art-atlas-content-v1\n")
    .update(JSON.stringify(data))
    .digest("hex")
    .slice(0, 20);
  const detailBase = `artwork-details/${revision}/`;
  const directory = path.join(publicRoot, detailBase);
  await fs.mkdir(directory, { recursive: true });
  const imagesByWork = new Map();
  for (const image of data.images) {
    const images = imagesByWork.get(image.artworkId) ?? [];
    images.push(image);
    imagesByWork.set(image.artworkId, images);
  }
  const sizes = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: 24 }, async () => {
      while (next < data.artworks.length) {
        const work = data.artworks[next++];
        assert.match(work.id, /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/);
        const json = JSON.stringify({
          work,
          images: imagesByWork.get(work.id) ?? [],
        });
        await fs.writeFile(path.join(directory, `${work.id}.json`), json);
        sizes.push(Buffer.byteLength(json));
      }
    }),
  );
  const index = {
    version: data.version,
    updatedAt: data.updatedAt,
    detailBase,
    periods: data.periods,
    artists: data.artists,
    topics: data.topics,
    artworks: data.artworks.map(({ id, title, artistIds, imageStatus }) => ({
      id,
      title,
      artistIds,
      ...(imageStatus ? { imageStatus } : {}),
    })),
    images: data.images
      .filter(({ role }) => role === "whole" || role === "reference")
      .map(({ id, artworkId, role, thumbnail }) => ({
        id,
        artworkId,
        role,
        thumbnail: { url: thumbnail.url },
      })),
    venues: data.venues.map(({ id, name, city, country, coordinates }) => ({
      id,
      name,
      city,
      country,
      coordinates,
    })),
    holdings: data.holdings.map(({ artworkId, venueId }) => ({
      artworkId,
      venueId,
    })),
  };
  // Publish the index only after every detail file exists.
  const json = JSON.stringify(index);
  const temporary = path.join(publicRoot, "catalog-index.json.tmp");
  await fs.writeFile(temporary, json);
  await fs.rename(temporary, path.join(publicRoot, "catalog-index.json"));
  // This directory contains only generated delivery snapshots, never source media.
  for (const entry of await fs.readdir(
    path.join(publicRoot, "artwork-details"),
  )) {
    if (/^[a-f0-9]{20}$/.test(entry) && entry !== revision)
      await fs.rm(path.join(publicRoot, "artwork-details", entry), {
        recursive: true,
      });
  }
  sizes.sort((a, b) => a - b);
  console.log(
    `渐进目录：${(Buffer.byteLength(json) / 1e6).toFixed(2)} MB；${sizes.length} 份作品详情，中位 ${(sizes[Math.floor(sizes.length / 2)] / 1000).toFixed(1)} KB。`,
  );
  return { revision, index };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  await buildContentDelivery(
    JSON.parse(await fs.readFile("public/catalog.json", "utf8")),
  );
