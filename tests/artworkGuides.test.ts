import { describe, expect, it } from "vitest";
import catalog from "../public/catalog.json";
import facts from "../content/artwork-guides/work-facts.json";
import { atlasSchema, primaryImage, workVenues } from "../src/domain/atlas";

const data = atlasSchema.parse(catalog);
const work = (id: string) => data.artworks.find((item) => item.id === id)!;

describe("artwork reading guides", () => {
  it("provides sourced background, subject and viewing guidance for every catalog entry", () => {
    for (const item of data.artworks) {
      const guide = item.guide;
      expect(guide, item.id).toBeDefined();
      expect(guide!.background.length, item.id).toBeGreaterThan(30);
      expect(guide!.story.length, item.id).toBeGreaterThan(30);
      expect(guide!.looking.length, item.id).toBeGreaterThanOrEqual(2);
      expect(guide!.sources.length, item.id).toBeGreaterThan(0);
      for (const source of guide!.sources) {
        expect(new URL(source.url).protocol).toMatch(/^https?:$/);
        expect(source.label.length).toBeGreaterThan(0);
      }
      if (guide!.scope === "contextual")
        expect(guide!.scopeNote?.length, item.id).toBeGreaterThan(10);
    }
    for (const id of Object.keys(facts.records))
      expect(work(id), id).toBeDefined();
  });

  it("does not turn shared names or everyday shepherds into unrelated biblical scenes", () => {
    expect(work("rembrandt-rrp-77b").guide!.story).not.toMatch(
      /苏珊娜传|两名长老|但以理/,
    );
    expect(work("millet-flock").guide!.story).not.toContain("《路加福音》");
    expect(work("titian-q20068831").guide!.story).not.toContain("《路加福音》");
    expect(work("rembrandt-rrp-140").guide!.story).not.toContain("剃去头发");
    expect(work("rembrandt-rrp-160").guide!.story).not.toContain("剃去头发");
  });

  it("keeps the Chicago and Kassel old men as separate works with their own sources and images", () => {
    expect(data.artworks.some((item) => item.id === "rembrandt-rrp-58")).toBe(
      false,
    );
    expect(work("rembrandt-gold-chain").sourceUrl).toContain("artic.edu");
    expect(work("rembrandt-rrp-82").sourceUrl).toContain("museum-kassel.de");
    expect(primaryImage(data, "rembrandt-gold-chain")?.sourceHash).not.toBe(
      primaryImage(data, "rembrandt-rrp-82")?.sourceHash,
    );
    expect(workVenues(data, "rembrandt-gold-chain")[0].id).not.toBe(
      workVenues(data, "rembrandt-rrp-82")[0].id,
    );
  });
});
