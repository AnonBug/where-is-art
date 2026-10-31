import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import catalogJson from "../public/data.json";
import imagesJson from "../public/assets/images.json";
import registryJson from "../public/collections.json";
import type { ArtworkImages, Catalog, CollectionRegistry } from "../src/types";

const catalog = catalogJson as Catalog;
const images = imagesJson as ArtworkImages;
const registry = registryJson as CollectionRegistry;

describe("shared directory data integrity", () => {
  it("has unique stable work and topic identifiers", () => {
    expect(new Set(catalog.works.map((work) => work.id)).size).toBe(
      catalog.works.length,
    );
    expect(
      new Set(registry.collections.map((collection) => collection.id)).size,
    ).toBe(registry.collections.length);
  });

  it("resolves every work’s artists, collection location, image and source", () => {
    for (const work of catalog.works) {
      expect(work.artistIds.length, work.id).toBeGreaterThan(0);
      for (const id of work.artistIds)
        expect(catalog.artists[id], `${work.id}: ${id}`).toBeDefined();
      if (work.museum) {
        const museum = catalog.museums[work.museum];
        expect(museum, work.id).toBeDefined();
        expect(Math.abs(museum.lat)).toBeLessThanOrEqual(90);
        expect(Math.abs(museum.lng)).toBeLessThanOrEqual(180);
      }
      expect(work.source, work.id).toMatch(/^https:\/\//);
      expect(images[work.id], work.id).toBeDefined();
      expect(
        existsSync(
          fileURLToPath(
            new URL(`../public/${images[work.id].path}`, import.meta.url),
          ),
        ),
        work.id,
      ).toBe(true);
    }
  });

  it("resolves topic cover, featured work and membership against shared works", () => {
    const ids = new Set(catalog.works.map((work) => work.id));
    for (const collection of registry.collections) {
      expect(collection.workIds.length).toBeGreaterThan(0);
      expect(new Set(collection.workIds).size).toBe(collection.workIds.length);
      for (const id of collection.workIds)
        expect(ids.has(id), `${collection.id}: ${id}`).toBe(true);
      expect(collection.workIds).toContain(collection.coverWorkId);
      expect(collection.workIds).toContain(collection.featuredWorkId);
      expect(["world", "collection", "europe"]).toContain(
        collection.defaultRegion,
      );
    }
  });
});
