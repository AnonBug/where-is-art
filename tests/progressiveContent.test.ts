import fs from "node:fs";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  atlasSchema,
  catalogIndexSchema,
  validateBrowseRelations,
  scopeWorks,
  scopeVenues,
  artistWorkCounts,
} from "../src/domain/atlas";

const fullBytes = fs.readFileSync("public/catalog.json");
const indexBytes = fs.readFileSync("public/catalog-index.json");
const full = atlasSchema.parse(JSON.parse(fullBytes.toString()));
const index = catalogIndexSchema.parse(JSON.parse(indexBytes.toString()));

describe("progressive delivery", () => {
  it("keeps the initial payload small without guides or full-image metadata", () => {
    expect(indexBytes.length).toBeLessThan(fullBytes.length * 0.11);
    expect(gzipSync(indexBytes).length).toBeLessThan(350_000);
    expect(index.artworks).toHaveLength(full.artworks.length);
    expect(indexBytes.toString()).not.toContain('"guide":');
    expect(indexBytes.toString()).not.toContain('"delivery":');
    expect(validateBrowseRelations(index)).toEqual([]);
  });
  it("preserves category, topic, favorite and map results before loading details", () => {
    const scopes = [
      "category:china",
      "category:foreign",
      "favorites",
      ...full.artists.map((a) => `artist:${a.id}`),
      ...full.topics.map((t) => `topic:${t.id}`),
    ];
    const favorites = new Set([
      "mona",
      "monet-q296425",
      "unknown",
      full.artworks.find((w) => w.imageStatus === "unavailable")!.id,
    ]);
    expect(artistWorkCounts(index)).toEqual(artistWorkCounts(full));
    for (const scope of scopes) {
      const a = scopeWorks(index, scope, favorites),
        b = scopeWorks(full, scope, favorites);
      expect(
        a.map((w) => w.id),
        scope,
      ).toEqual(b.map((w) => w.id));
      expect(
        scopeVenues(index, a).map((v) => v.id),
        scope,
      ).toEqual(scopeVenues(full, b).map((v) => v.id));
    }
  });
  it("delivers every original artwork and all associated images without losing data", () => {
    const raw = JSON.parse(fullBytes.toString());
    const byWork = new Map<string, unknown[]>();
    for (const image of raw.images) {
      const images = byWork.get(image.artworkId) ?? [];
      images.push(image);
      byWork.set(image.artworkId, images);
    }
    for (const work of raw.artworks) {
      const payload = JSON.parse(
        fs.readFileSync(`public/${index.detailBase}${work.id}.json`, "utf8"),
      );
      expect(payload.work, work.id).toEqual(work);
      expect(payload.images, work.id).toEqual(byWork.get(work.id) ?? []);
    }
  });
});
