import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  atlasSchema,
  artistWorkCounts,
  primaryImage,
  validateRelations,
  workVenues,
} from "../src/domain/atlas";
// Read the large import at runtime rather than expanding it into JS modules.
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const data = atlasSchema.parse(read("public/catalog.json"));
const imported = read("content/oss-import-catalog.json");
const research = read("content/oss-import-research.json");
const manifest = read("content/oss-import-media-manifest.json");
const original = read("content/foreign-catalog.json");

describe("user supplied six-artist OSS catalogue", () => {
  it("reconciles every source row once and retains all existing stable IDs", () => {
    expect(data.artworks).toHaveLength(6130);
    expect(data.images).toHaveLength(5875);
    expect(imported.artworks).toHaveLength(5197);
    expect(manifest.images).toHaveLength(4705);
    expect(research.records).toHaveLength(5228);
    expect(
      research.records.filter((r: { reused: boolean }) => r.reused),
    ).toHaveLength(31);
    expect(validateRelations(data)).toEqual([]);
    const hash = createHash("sha256")
      .update(readFileSync("content/" + research.sourceFile))
      .digest("hex");
    expect(hash).toBe(research.sourceSha256);
    const counts = artistWorkCounts(data);
    expect(
      Object.fromEntries(
        ["raphael", "manet", "monet", "van-gogh", "gauguin", "mondrian"].map(
          (id) => [id, counts.get(id)],
        ),
      ),
    ).toEqual({
      raphael: 194,
      manet: 384,
      monet: 2024,
      "van-gogh": 961,
      gauguin: 597,
      mondrian: 576,
    });
    for (const work of original.artworks) {
      expect(data.artworks.filter((item) => item.id === work.id)).toHaveLength(
        1,
      );
    }
  });

  it("keeps unavailable images, reference images and license review states distinct", () => {
    const missing = imported.artworks.filter(
      (work: { imageStatus?: string }) => work.imageStatus === "unavailable",
    );
    expect(missing).toHaveLength(492);
    for (const work of missing)
      expect(primaryImage(data, work.id)).toBeUndefined();
    expect(
      manifest.images.filter(
        (image: { role: string }) => image.role === "reference",
      ),
    ).toHaveLength(1);
    expect(
      manifest.images.some(
        (image: { publicationStatus: string }) =>
          image.publicationStatus === "review-required",
      ),
    ).toBe(true);
    for (const image of manifest.images) {
      expect(image.delivery.sha256).toMatch(/^(?:[a-f0-9]{64})?$/);
      expect(image.delivery.md5).toMatch(/^[a-f0-9]{32}$/);
      expect(image.sourceHash).toBe("");
      expect(image.sourceUrl).toMatch(/^https?:\/\//);
      expect(image.credit).not.toBe("");
    }
    expect(
      data.artworks.find((work) => work.id === "raphael-athens")?.guide?.scope,
    ).toBe("individual");
    expect(
      imported.artworks.every(
        (work: { guide?: unknown }) => work.guide === undefined,
      ),
    ).toBe(true);
  });

  it("does not invent coordinates for private or ambiguous collection indexes", () => {
    for (const record of research.records.filter(
      (item: { reused: boolean; collectionIndex: string }) =>
        !item.reused &&
        /private|私人|私藏|；|^Unknown$/i.test(item.collectionIndex),
    )) {
      expect(
        workVenues(data, record.artworkId).every(
          (venue) => venue.coordinates === null,
        ),
        record.artworkId,
      ).toBe(true);
    }
    expect(
      workVenues(data, "van-gogh-starry-night").map((venue) => venue.id),
    ).toEqual(["moma"]);
    expect(workVenues(data, "raphael-athens").map((venue) => venue.id)).toEqual(
      ["vatican-raphael"],
    );
  });
});
