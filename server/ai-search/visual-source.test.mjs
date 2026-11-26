import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { VISUAL_ROOT } from "./visual.mjs";
import {
  VISUAL_POINTER,
  createVisualLoader,
  registryRevision,
  sha256,
} from "./visual-source.mjs";
import { createCatalogLoader, createHandler } from "./index.mjs";
import { validatePlan } from "./search.mjs";
const annotations = JSON.parse(
  readFileSync(
    new URL(
      "../../tests/fixtures/visual-search/annotations.json",
      import.meta.url,
    ),
  ),
);
const manifest = JSON.parse(
  readFileSync(
    new URL(
      "../../tests/fixtures/visual-search/manifest.json",
      import.meta.url,
    ),
  ),
);
const sea = manifest.works.find(
    (w) => w.artwork_id === "monet-list-a1eee521ebc9",
  ),
  garden = manifest.works[0];
const revision = "f".repeat(20);

function setup() {
  let clock = 100,
    pointer;
  const files = new Map();
  const batch = (name, works, values = annotations) => {
    const root = `${VISUAL_ROOT}${name}/`;
    const m = Buffer.from(JSON.stringify({ works }));
    const a = Buffer.from(
      JSON.stringify(
        Object.fromEntries(
          works
            .filter((w) => values[w.artwork_id])
            .map((w) => [w.artwork_id, values[w.artwork_id]]),
        ),
      ),
    );
    files.set(root + "manifest.json", m);
    files.set(root + "annotations.json", a);
    return {
      manifest: root + "manifest.json",
      annotations: root + "annotations.json",
      manifestSha256: sha256(m),
      annotationsSha256: sha256(a),
    };
  };
  const publish = (batches) => {
    pointer = {
      schemaVersion: 1,
      revision: registryRevision(batches),
      batches,
    };
    files.set(VISUAL_POINTER, Buffer.from(JSON.stringify(pointer)));
  };
  const fetcher = vi.fn(async (url) =>
    files.has(url)
      ? new Response(files.get(url))
      : new Response("missing", { status: 404 }),
  );
  const load = createVisualLoader({ fetcher, now: () => clock });
  return {
    batch,
    publish,
    files,
    fetcher,
    load,
    tick: (ms = 60_001) => {
      clock += ms;
    },
    now: () => clock,
  };
}

describe("OSS visual annotation refresh", () => {
  it("adds a remote batch after TTL without re-fetching unchanged batches, and retains per-batch source links", async () => {
    const s = setup(),
      first = s.batch("first", [garden]),
      second = s.batch("second", [sea]);
    s.publish([first]);
    const initial = await s.load();
    expect(initial.entries).toHaveLength(1);
    s.publish([first, second]);
    expect((await s.load()).entries).toHaveLength(1);
    s.tick();
    const next = await s.load();
    expect(next.entries).toHaveLength(2);
    expect(next.revision).not.toBe(initial.revision);
    expect(next.entries[1].annotationUrl).toBe(
      `${VISUAL_ROOT}second/${sea.annotation_file}`,
    );
    expect(
      s.fetcher.mock.calls.filter(([url]) => url === first.annotations),
    ).toHaveLength(1);
  });
  it("merges duplicate IDs with the latest batch, removes withdrawn batches, and ignores reference/missing images", async () => {
    const s = setup();
    const replacement = structuredClone(annotations);
    replacement[sea.artwork_id].emotions[0].label = "静谧";
    const a = s.batch("first", [sea]),
      b = s.batch(
        "later",
        [
          sea,
          { artwork_id: "missing", status: "missing_image" },
          { artwork_id: "reference", status: "reference_only" },
        ],
        replacement,
      );
    s.publish([a, b]);
    const next = await s.load();
    expect(next.entries).toHaveLength(1);
    expect(next.entries[0].annotation.emotions[0].label).toBe("静谧");
    s.publish([]);
    s.tick();
    expect((await s.load()).entries).toHaveLength(0);
  });
  it("keeps the last valid snapshot on corrupted or missing uploads and recovers after repair", async () => {
    const s = setup(),
      a = s.batch("first", [garden]),
      b = s.batch("second", [sea]);
    s.publish([a]);
    const initial = await s.load();
    s.publish([a, b]);
    const good = s.files.get(b.annotations);
    s.files.set(b.annotations, Buffer.from("{}"));
    s.tick();
    const stale = await s.load();
    expect(stale.stale).toBe(true);
    expect(stale.revision).toBe(initial.revision);
    expect(stale.entries).toHaveLength(1);
    s.files.set(b.annotations, good);
    s.tick(10_001);
    const fixed = await s.load();
    expect(fixed.stale).toBe(false);
    expect(fixed.entries).toHaveLength(2);
    s.files.delete(VISUAL_POINTER);
    s.tick();
    expect((await s.load()).entries).toHaveLength(2);
  });
  it("rejects external URLs and invalid field shapes before replacing the index, including cold starts", async () => {
    const s = setup(),
      a = s.batch("first", [sea]);
    s.publish([{ ...a, annotations: "https://example.com/annotations.json" }]);
    expect(await s.load()).toMatchObject({
      revision: "unavailable",
      entries: [],
      stale: true,
    });
    expect(
      s.fetcher.mock.calls.some(([url]) =>
        url.startsWith("https://example.com"),
      ),
    ).toBe(false);
    const malformed = structuredClone(annotations);
    malformed[sea.artwork_id].subjects = "not an array";
    s.publish([s.batch("invalid", [sea], malformed)]);
    s.tick();
    expect((await s.load()).stale).toBe(true);
  });
  it("coalesces concurrent refresh requests", async () => {
    const s = setup();
    s.publish([s.batch("first", [sea])]);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => s.load()),
    );
    expect(results.every((x) => x.entries.length === 1)).toBe(true);
    expect(
      s.fetcher.mock.calls.filter(([url]) => url === VISUAL_POINTER),
    ).toHaveLength(1);
  });
  it("invalidates both prepared catalog and same-query result caches when annotations change, without changing the artwork revision", async () => {
    const s = setup(),
      a = s.batch("first", [garden]),
      b = s.batch("second", [sea]);
    const data = {
      detailBase: `artwork-details/${revision}/`,
      artworks: [garden, sea].map((w) => ({
        id: w.artwork_id,
        title: w.title,
        artistIds: [],
      })),
      images: [garden, sea].map((w) => ({
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
    const fetchJson = vi.fn(async (url) =>
      url.endsWith("catalog-index.json")
        ? data
        : { schemaVersion: 1, revision, documents: [] },
    );
    const getCatalog = createCatalogLoader({ fetchJson, loadVisual: s.load });
    const reserve = vi.fn(async () => null);
    const handler = createHandler({
      getCatalog,
      reserve,
      now: s.now,
      plan: async (catalog) =>
        validatePlan(
          { contentTerms: ["孤独"], evidenceGroups: [["孤独"]] },
          catalog,
        ),
      review: async () => ({ matches: [{ n: 0, p: 0 }] }),
    });
    const event = {
      rawPath: "/api/ai-search",
      requestContext: { http: { method: "POST", sourceIp: "192.0.2.1" } },
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "孤独",
        revision,
        visualAnnotations: true,
      }),
    };
    s.publish([a]);
    const first = JSON.parse((await handler(event, {})).body);
    expect(first.total).toBe(0);
    expect(first.visualCount).toBe(1);
    s.publish([a, b]);
    s.tick();
    const second = JSON.parse((await handler(event, {})).body);
    expect(second.results[0].id).toBe(sea.artwork_id);
    expect(second.visualCount).toBe(2);
    expect(second.visualRevision).not.toBe(first.visualRevision);
    expect(second.cached).not.toBe(true);
    expect(fetchJson).toHaveBeenCalledTimes(2); // Catalog + text corpus, once each.
    expect(reserve).toHaveBeenCalledTimes(3); // No second call for the initial empty candidate set.
    s.tick(1100);
    expect(JSON.parse((await handler(event, {})).body).cached).toBe(true);
  });
});
