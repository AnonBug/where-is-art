import { describe, expect, it } from "vitest";
import mediaIndex from "../content/media-index.json";
import catalog from "../public/catalog.json";
import foreignCatalog from "../content/foreign-catalog.json";
import mastersCatalog from "../content/masters-catalog.json";
import mastersMedia from "../content/masters-media-manifest.json";
import wuDaoziCatalog from "../content/wu-daozi-catalog.json";
import tangExpansion from "../content/tang-expansion-catalog.json";
import tangExpansionMedia from "../content/tang-expansion-media-manifest.json";
import {
  atlasSchema,
  validateRelations,
  scopeWorks,
  scopeVenues,
  venueWorks,
  primaryImage,
  workVenues,
  artistWorkCounts,
} from "../src/domain/atlas";
const data = atlasSchema.parse(catalog);
const files = new Map(mediaIndex.files.map((file) => [file.url, file]));

describe("atlas content contract", () => {
  it("counts browsable works per artist, including collaborations but excluding detail-only records", () => {
    const copy = structuredClone(data);
    const work = copy.artworks.find((item) => item.id === "baptism")!;
    const image = primaryImage(copy, work.id)!;
    copy.images.push({ ...image, id: "extra-detail", role: "detail" });
    copy.holdings.push(
      ...copy.holdings.filter((item) => item.artworkId === work.id),
    );
    let counts = artistWorkCounts(copy);
    for (const artist of copy.artists)
      expect(counts.get(artist.id)).toBe(
        scopeWorks(copy, `artist:${artist.id}`).length,
      );
    expect(counts.get("verrocchio")).toBe(1);
    copy.images = copy.images.filter(
      (item) => item.artworkId !== work.id || item.role === "detail",
    );
    counts = artistWorkCounts(copy);
    expect(counts.get("verrocchio")).toBe(0);
    expect(counts.get("leonardo")).toBe(20);
  });
  it("resolves all artwork, artist, venue, topic and image relations", () => {
    expect(validateRelations(data)).toEqual([]);
    expect(data.artworks).toHaveLength(
      38 +
        foreignCatalog.artworks.length +
        mastersCatalog.artworks.length +
        wuDaoziCatalog.artworks.length +
        tangExpansion.artworks.length,
    );
    expect(scopeWorks(data, "artist:tang-yin")).toHaveLength(17);
    expect(data.images.filter((x) => x.delivery.kind === "dzi")).toHaveLength(
      8 +
        tangExpansionMedia.images.filter(
          (image) => image.delivery.kind === "dzi",
        ).length,
    );
  });
  it("maps only the two selected Wu Daozi attributed scrolls with native-resolution images", () => {
    const works = scopeWorks(data, "artist:wu-daozi");
    expect(works.map((work) => work.id)).toEqual([
      "wu-daozi-songzi",
      "wu-daozi-eightyseven",
    ]);
    expect(
      data.artists.find((artist) => artist.id === "wu-daozi")?.periodId,
    ).toBe("tang");
    expect(workVenues(data, works[0].id).map((venue) => venue.name)).toEqual([
      "大阪市立美术馆",
    ]);
    expect(workVenues(data, works[1].id).map((venue) => venue.name)).toEqual([
      "徐悲鸿纪念馆",
    ]);
    expect(works[0].note).toContain("后人托名");
    expect(works[1].note).toContain("佚名");
    for (const work of works) {
      expect(work.dateLabel).toContain("传吴道子");
      const image = primaryImage(data, work.id)!;
      expect(image.delivery.kind).toBe("dzi");
      expect(image.delivery.width).toBe(image.width);
      expect(image.delivery.height).toBe(image.height);
      expect(image.width).toBeGreaterThan(25_000);
    }
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
    expect(foreign).toHaveLength(
      21 + foreignCatalog.artworks.length + mastersMedia.images.length,
    );
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
        const file = files.get(resource.url);
        expect(file, resource.url).toBeDefined();
        if ("bytes" in resource)
          expect(file!.bytes, resource.url).toBe(resource.bytes);
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
