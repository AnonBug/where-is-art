import { describe, expect, it } from "vitest";
import catalog from "../public/catalog.json";
import foreign from "../content/foreign-catalog.json";
import sources from "../content/foreign-sources.json";
import {
  atlasSchema,
  scopeWorks,
  workVenues,
  primaryImage,
} from "../src/domain/atlas";

const data = atlasSchema.parse(catalog);
describe("Western painting corpus", () => {
  it("makes each researched artist available in a populated period and scope", () => {
    expect(foreign.artists).toHaveLength(33);
    expect(foreign.artworks).toHaveLength(137);
    for (const artist of foreign.artists) {
      expect(
        data.periods.some(
          (p) => p.id === artist.periodId && p.category === "foreign",
        ),
      ).toBe(true);
      expect(
        scopeWorks(data, `artist:${artist.id}`).length,
      ).toBeGreaterThanOrEqual(3);
      expect(
        scopeWorks(data, `artist:${artist.id}`).length,
      ).toBeLessThanOrEqual(8);
    }
    expect(
      scopeWorks(data, "topic:western-journey")
        .map((w) => w.id)
        .sort(),
    ).toEqual(foreign.artworks.map((w) => w.id).sort());
    expect(scopeWorks(data, "artist:leonardo")).toHaveLength(21);
    expect(scopeWorks(data, "artist:monet")).toHaveLength(6);
    expect(scopeWorks(data, "artist:van-gogh")).toHaveLength(6);
  });

  it("connects every addition to a sourced holding and a local whole image with its reviewed status", () => {
    for (const work of foreign.artworks) {
      const venue = workVenues(data, work.id);
      expect(venue).toHaveLength(1);
      expect(venue[0].coordinates).not.toBeNull();
      const image = primaryImage(data, work.id)!;
      expect(image.delivery.url).toMatch(/^media\/foreign\//);
      const source = sources.sources.find((s) => s.artworkId === work.id)!;
      expect(image.publicationStatus).toBe(
        "publicationStatus" in source ? source.publicationStatus : "cleared",
      );
      expect(
        sources.sources.find((s) => s.artworkId === work.id)?.objectSourceUrl,
      ).toBe(work.sourceUrl);
      expect(
        foreign.holdings.find((h) => h.artworkId === work.id)?.sourceUrl,
      ).toBe(work.sourceUrl);
    }
  });

  it("keeps similarly named versions and artists separate", () => {
    expect(workVenues(data, "caravaggio-emmaus")[0].id).toBe("london");
    expect(workVenues(data, "munch-scream")[0].id).toBe("national-norway");
    expect(workVenues(data, "van-gogh-starry-night")[0].id).toBe("moma");
    expect(workVenues(data, "seurat-grande-jatte")[0].id).toBe("artic");
    const work = (id: string) => data.artworks.find((w) => w.id === id)!;
    expect(work("gris-picasso").artistIds).toEqual(["gris"]);
    expect(work("goya-third-may").dateLabel).toBe("1814年");
    expect(work("ingres-grisaille").note).toContain("工作室");
    expect(workVenues(data, "van-gogh-bedroom")[0].id).toBe("artic");
    expect(workVenues(data, "van-gogh-sunflowers")[0].id).toBe("london");
    expect(workVenues(data, "matisse-dance")[0].id).toBe(
      "hermitage-general-staff",
    );
    expect(workVenues(data, "raphael-athens")[0].id).toBe("vatican-raphael");
    expect(workVenues(data, "gris-sunblind")[0].id).toBe("tate-modern");
    expect(work("david-horatii").note).toContain("摹本");
  });
});
