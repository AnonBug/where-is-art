import { describe, it, expect, vi } from "vitest";
import { addVisualAnnotations as addSnapshot } from "./visual.mjs";
import { batchEntries } from "./visual-source.mjs";
import { readFileSync } from "node:fs";
const VISUAL_SOURCE =
  "https://halfbvg-art-assets.oss-cn-shanghai.aliyuncs.com/where-is-art/annotations/visual-semantics/53c20b880021864a89b7-39322359699354/";
const visualAnnotations = JSON.parse(
  readFileSync(
    new URL(
      "../../tests/fixtures/visual-search/annotations.json",
      import.meta.url,
    ),
  ),
);
const visualManifest = JSON.parse(
  readFileSync(
    new URL(
      "../../tests/fixtures/visual-search/manifest.json",
      import.meta.url,
    ),
  ),
);
const addVisualAnnotations = (data, corpus, annotations = visualAnnotations) =>
  addSnapshot(data, corpus, {
    entries: batchEntries(
      annotations,
      visualManifest,
      VISUAL_SOURCE + "manifest.json",
    ),
  });
import { prepareCatalog, validatePlan } from "./search.mjs";
import { retrieveCandidates, reviewedResults } from "./retrieval.mjs";
import { createHandler } from "./index.mjs";

const revision = "e".repeat(20);
const data = {
  artworks: visualManifest.works.map((w) => ({
    id: w.artwork_id,
    title: w.title,
    artistIds: [],
  })),
  images: visualManifest.works.map((w) => ({
    id: w.image_id,
    artworkId: w.artwork_id,
    role: "whole",
    thumbnail: { url: w.image_url.replace("preview.webp", "thumb.webp") },
  })),
  artists: [],
  topics: [],
  venues: [],
  holdings: [],
};
const empty = { schemaVersion: 1, revision, documents: [] };
const corpus = addVisualAnnotations(data, empty);
const catalog = prepareCatalog(data, revision, corpus);
const sea = "monet-list-a1eee521ebc9",
  reader = "van-gogh-q26221127";
const plan = (terms) =>
  validatePlan(
    { contentTerms: terms, evidenceGroups: terms.map((term) => [term]) },
    catalog,
  );

describe("visual annotation search", () => {
  it("accepts a bounded surplus of recall synonyms without discarding constraints", () => {
    const terms = [
      "独处",
      "独自",
      "一个人",
      "单独",
      "自在",
      "安适",
      "闲适",
      "悠闲",
      "放松",
    ];
    const parsed = validatePlan(
      {
        contentTerms: terms,
        evidenceGroups: [
          ["独处", "一个人"],
          ["自在", "安适"],
        ],
      },
      catalog,
    );
    expect(parsed.contentTerms).toHaveLength(9);
    expect(parsed.evidenceGroups).toHaveLength(2);
    expect(() =>
      validatePlan(
        { contentTerms: Array(17).fill("独处"), evidenceGroups: [["独处"]] },
        catalog,
      ),
    ).toThrow();
  });
  it("loads all 100 source records and preserves every generated query as recall hints, separate from evidence", () => {
    expect(corpus.visualCount).toBe(100);
    expect(corpus.documents).toHaveLength(100);
    expect(corpus.documents.flatMap((d) => d.passages)).toHaveLength(200);
    expect(
      Object.values(visualAnnotations).flatMap((a) => a.search_queries),
    ).toHaveLength(800);
    for (const doc of corpus.documents) {
      for (const query of visualAnnotations[doc.id].search_queries)
        expect(doc.passages[0].searchHints).toContain(query);
      for (const p of doc.passages) {
        expect(p.text.length).toBeLessThanOrEqual(500);
        expect(p.sources[0].url.startsWith(VISUAL_SOURCE)).toBe(true);
      }
    }
    expect(empty.documents).toHaveLength(0);
  });
  it("finds loneliness synonyms without returning comfortable solitude as loneliness", () => {
    for (const term of ["孤独", "寂寞", "孤独感"]) {
      const p = plan([term]);
      const { candidates } = retrieveCandidates(catalog, p, term);
      expect(candidates.map((c) => c.entry.work.id)).toHaveLength(7);
      expect(candidates[0].entry.work.id).toBe(sea);
      expect(candidates.some((c) => c.entry.work.id === reader)).toBe(false);
      const pIndex = candidates[0].passages.findIndex(
        (p) => p.field === "visual_emotion",
      );
      const result = reviewedResults(
        { matches: [{ n: 0, p: pIndex, text: "fabricated" }] },
        candidates,
        p,
      );
      expect(result.results[0].evidence.text).toContain(
        "空旷滩面只有一个很小的人影",
      );
      expect(result.results[0].supportingEvidence[0].field).toBe(
        "visual_description",
      );
      expect(JSON.stringify(result)).not.toContain("fabricated");
    }
  });
  it("combines solitude and comfort from separate visual fields", () => {
    const { candidates } = retrieveCandidates(
      catalog,
      plan(["独处", "自在"]),
      "一个人但很自在",
    );
    expect(candidates.map((c) => c.entry.work.id).sort()).toEqual(
      [reader, "monet-q22338327", "monet-list-95e67fbaeb39"].sort(),
    );
  });
  it("excludes annotations when an image is replaced, a work is missing, or only a reference image remains", () => {
    const changed = structuredClone(data);
    changed.images[0].thumbnail.url = "https://example.com/replaced/thumb.webp";
    changed.artworks = changed.artworks.filter(
      (w) => w.id !== data.artworks[1].id,
    );
    changed.images[2].role = "reference";
    const next = addVisualAnnotations(changed, empty);
    expect(next.visualCount).toBe(97);
    for (const w of data.artworks.slice(0, 3))
      expect(next.documents.some((d) => d.id === w.id)).toBe(false);
  });
  it("does not treat generated example queries as evidence for an unsupported subject", () => {
    const a = structuredClone(visualAnnotations);
    a[sea].search_queries.push("独角兽飞过海面");
    const annotated = prepareCatalog(
      data,
      revision,
      addVisualAnnotations(data, empty, a),
    );
    expect(
      retrieveCandidates(annotated, plan(["独角兽"]), "独角兽").candidates,
    ).toHaveLength(0);
  });
  it("separates legacy and visual clients' caches and preserves per-call quota reservations", async () => {
    let time = 10000;
    const reserve = vi.fn(async () => null);
    const legacy = prepareCatalog(data, revision, empty);
    const getCatalog = vi.fn(async (_revision, visual) =>
      visual ? catalog : legacy,
    );
    const handler = createHandler({
      getCatalog,
      now: () => time,
      reserve,
      plan: async () => plan(["孤独"]),
      review: async () => ({ matches: [{ n: 0, p: 0 }] }),
    });
    const request = (visualAnnotations) => ({
      rawPath: "/api/ai-search",
      requestContext: { http: { method: "POST", sourceIp: "192.0.2.1" } },
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "孤独", revision, visualAnnotations }),
    });
    expect(JSON.parse((await handler(request(undefined), {})).body).total).toBe(
      0,
    );
    time += 1100;
    const result = JSON.parse((await handler(request(true), {})).body);
    expect(result.total).toBe(1);
    expect(result.visualCount).toBe(100);
    expect(getCatalog).toHaveBeenLastCalledWith(revision, true);
    expect(reserve).toHaveBeenCalledTimes(3);
    time += 1100;
    expect(JSON.parse((await handler(request(true), {})).body).cached).toBe(
      true,
    );
    expect(reserve).toHaveBeenCalledTimes(3);
  });
});
