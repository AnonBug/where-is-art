import { describe, expect, it } from "vitest";
import catalog from "../public/catalog.json";
import masters from "../content/masters-catalog.json";
import research from "../content/masters-research.json";
import coverage from "../content/masters-coverage.json";
import sources from "../content/masters-sources.json";
import manifest from "../content/masters-media-manifest.json";
import {
  atlasSchema,
  artistWorkCounts,
  primaryImage,
  workVenues,
} from "../src/domain/atlas";
const data = atlasSchema.parse(catalog);

describe("Titian and Rembrandt research corpus", () => {
  it("accounts for every row in the pinned inventories without counting series or details twice", () => {
    expect(coverage.rows.filter((r) => r.artist === "rembrandt")).toHaveLength(
      348,
    );
    expect(coverage.rows.filter((r) => r.artist === "titian")).toHaveLength(
      164,
    );
    for (const row of coverage.rows) {
      expect([
        "included",
        "excluded-attribution",
        "not-a-separate-work",
      ]).toContain(row.status);
      if ("artworkIds" in row)
        for (const id of row.artworkIds!)
          expect(
            data.artworks.some((w) => w.id === id),
            row.title,
          ).toBe(true);
    }
    const titian = coverage.rows.filter((r) => r.artist === "titian");
    const center = titian.find((r) => r.title.startsWith("Center panel"))!;
    const whole = titian.find((r) => r.title === "Averoldi Polyptych")!;
    expect(center.artworkIds).toEqual(whole.artworkIds);
    expect(data.artworks.some((w) => w.id === "titian-q58177931")).toBe(false);
    expect(data.artworks.some((w) => w.id === "titian-q17321337")).toBe(false);
    const ids = research.records.map((r) => r.artworkId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps existing IDs and distinguishes missing images from browsable paintings", () => {
    const counts = artistWorkCounts(data);
    for (const artist of ["titian", "rembrandt"]) {
      expect(counts.get(artist)).toBe(
        4 +
          manifest.images.filter((i) => i.artworkId.startsWith(artist + "-"))
            .length,
      );
      expect(counts.get(artist)).toBeGreaterThan(300);
    }
    expect(research.records.filter((r) => r.existing)).toHaveLength(8);
    for (const work of masters.artworks) {
      const image = primaryImage(data, work.id);
      expect(Boolean(image)).toBe(!("imageStatus" in work));
      if (!image) expect(work.note).toContain("图像");
    }
  });

  it("retains image identity, attribution and license evidence for every new image", () => {
    expect(manifest.images).toHaveLength(sources.sources.length);
    for (const image of manifest.images) {
      const source = sources.sources.find(
        (s) => s.artworkId === image.artworkId,
      )!;
      expect(source).toBeDefined();
      expect(image.sourceHash).toBe(source.downloadSha256);
      expect(image.sourceUrl).toBe(source.sourceUrl);
      expect(image.credit).toBe(source.credit);
      expect(image.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\//);
      expect(image.delivery.url).toContain(
        `/masters/${image.artworkId}/${image.sourceHash.slice(0, 12)}/`,
      );
      expect(Math.max(image.width, image.height)).toBeLessThanOrEqual(3840);
      expect(image.publicationStatus).toBe("cleared");
    }
    const pesaro = sources.sources.find(
      (s) => s.artworkId === "titian-q572697",
    )!;
    expect(pesaro.fileTitle).toBe("Tizian 039 (2).jpg");
    expect(primaryImage(data, "titian-q3850314")?.role).toBe("reference");
    expect(
      data.artworks.find((w) => w.id === "titian-q3850314")?.note,
    ).toContain("焚毁");
  });

  it("uses the recent Rijksmuseum research and does not map collection headquarters as the artworks location", () => {
    for (const q of ["q21856038", "q123786559", "q123786572"]) {
      const id = "rembrandt-" + q;
      expect(data.artworks.find((w) => w.id === id)?.sourceUrl).toMatch(
        /^https:\/\/www\.rijksmuseum\.nl\//,
      );
      expect(workVenues(data, id).map((v) => v.id)).toEqual(["rijks"]);
    }
    for (const q of ["q333515", "q1459037", "q812285", "q653002"])
      expect(
        data.venues.find((v) => v.id === "masters-" + q)?.coordinates,
      ).toBeNull();
    expect(workVenues(data, "titian-q20565519").map((v) => v.id)).toEqual([
      "mfa-boston",
    ]);
  });
});
