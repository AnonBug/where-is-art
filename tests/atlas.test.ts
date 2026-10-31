import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import catalog from "../public/catalog.json";
import foreignCatalog from "../content/foreign-catalog.json";
import {
  atlasSchema,
  validateRelations,
  scopeWorks,
  scopeVenues,
  venueWorks,
  primaryImage,
  workVenues,
} from "../src/domain/atlas";
const data = atlasSchema.parse(catalog);

describe("atlas content contract", () => {
  it("resolves all artwork, artist, venue, topic and image relations", () => {
    expect(validateRelations(data)).toEqual([]);
    expect(data.artworks).toHaveLength(38 + foreignCatalog.artworks.length);
    expect(scopeWorks(data, "artist:tang-yin")).toHaveLength(17);
    expect(data.images.filter((x) => x.delivery.kind === "dzi")).toHaveLength(
      6,
    );
  });
  it("keeps unknown locations off the map while preserving their works", () => {
    for (const id of ["tang-yin-15", "salvator"]) {
      expect(data.artworks.some((w) => w.id === id)).toBe(true);
      expect(workVenues(data, id)).toEqual([]);
      expect(primaryImage(data, id)).toBeDefined();
    }
  });
  it("counts unique works across venues and collaborative artists", () => {
    const copy = structuredClone(data);
    const holding = copy.holdings[0];
    const second = copy.venues.find((v) => v.id !== holding.venueId)!;
    copy.holdings.push({ ...holding, venueId: second.id }, { ...holding });
    const selected = copy.artworks.filter((w) => w.id === holding.artworkId);
    expect(
      venueWorks(copy, selected, [holding.venueId, second.id]),
    ).toHaveLength(1);
    expect(scopeVenues(copy, selected)).toHaveLength(2);
    const foreign = scopeWorks(data, "category:foreign");
    expect(new Set(foreign.map((w) => w.id)).size).toBe(foreign.length);
    expect(foreign).toHaveLength(21 + foreignCatalog.artworks.length);
  });
  it("does not mix topics and artist scopes", () => {
    const landscape = scopeWorks(data, "topic:landscape");
    expect(landscape.map((w) => w.id)).toEqual(
      data.topics.find((t) => t.id === "landscape")!.artworkIds,
    );
    expect(
      scopeWorks(data, "artist:verrocchio").every((w) =>
        w.artistIds.includes("verrocchio"),
      ),
    ).toBe(true);
    expect(scopeWorks(data, "topic:missing")).toEqual([]);
  });
  it("ships bounded whole images or DZI and preserves separate roll details", () => {
    for (const image of data.images) {
      for (const resource of [image.thumbnail, image.preview, image.delivery]) {
        const file = resolve("public", resource.url);
        expect(existsSync(file), resource.url).toBe(true);
        if ("bytes" in resource)
          expect(statSync(file).size, resource.url).toBe(resource.bytes);
      }
      if (image.delivery.kind === "image")
        expect(image.delivery.bytes).toBeLessThanOrEqual(20_000_000);
    }
    expect(
      data.images.filter(
        (x) => x.artworkId === "tang-yin-11" && x.role === "detail",
      ),
    ).toHaveLength(12);
    expect(
      data.images.filter(
        (x) => x.artworkId === "tang-yin-13" && x.role === "detail",
      ),
    ).toHaveLength(5);
  });
  it("rejects broken relationships before rendering", () => {
    const copy = structuredClone(data);
    copy.artworks[0].artistIds = ["missing"];
    copy.venues[0].coordinates = [181, 91];
    copy.topics[0].artworkIds.push("missing");
    expect(validateRelations(copy).length).toBeGreaterThanOrEqual(3);
  });
});
