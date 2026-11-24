import { describe, it, expect, vi } from "vitest";
import { createSearchCorpus } from "./corpus.mjs";
import { prepareCatalog, validatePlan, keywordSearch } from "./search.mjs";
import {
  retrieveCandidates,
  reviewedResults,
  reviewMessages,
} from "./retrieval.mjs";
import { createHandler } from "./index.mjs";

const revision = "b".repeat(20);
const source = { label: "馆藏解读", url: "https://museum.example/work" };
const story =
  "画中人物因城市被焚毁而哀伤。远处的火光将他的沉思与城市灾难联系起来。";
const data = {
  artists: [
    { id: "r", name: "伦勃朗" },
    { id: "m", name: "莫奈" },
  ],
  topics: [],
  venues: [
    { id: "v", name: "国家博物馆", city: "阿姆斯特丹", country: "荷兰" },
  ],
  holdings: [{ artworkId: "target", venueId: "v" }],
  artworks: [
    {
      id: "target",
      title: "Jeremiah",
      artistIds: ["r"],
      description: "",
      guide: {
        scope: "individual",
        story,
        background: "早期历史画，以老人凝望远处为主题。",
        looking: ["比较火光与沉重的衣料。"],
        sources: [source],
      },
    },
    {
      id: "distractor",
      title: "Portrait",
      artistIds: ["m"],
      description:
        "老人手持白手帕。不能据此断言她在哀悼，也没有城市被焚毁的证据。",
      sourceUrl: source.url,
    },
    {
      id: "hidden",
      title: "无图记录",
      artistIds: ["r"],
      description: story,
      sourceUrl: source.url,
    },
    {
      id: "draft",
      title: "旧稿",
      artistIds: ["r"],
      description: "",
      guide: { scope: "contextual", story, sources: [source] },
    },
  ],
  images: ["target", "distractor", "draft"].map((artworkId) => ({
    artworkId,
    role: "whole",
  })),
};
const corpus = createSearchCorpus(data, revision);
const catalog = prepareCatalog(data, revision, corpus);
const plan = validatePlan(
  {
    contentTerms: ["焚毁", "城市", "哀伤"],
    evidenceGroups: [
      ["焚毁", "毁灭"],
      ["哀伤", "哀悼"],
    ],
  },
  catalog,
);
const query = "为焚毁的城市哀伤的老人";

describe("published story retrieval", () => {
  it("keeps supporting passages when identity and action are documented in separate fields", () => {
    const grouped = { ...plan, evidenceGroups: [["老人"], ["焚毁"], ["哀伤"]] };
    const { candidates } = retrieveCandidates(catalog, grouped, query);
    const n = candidates.findIndex((c) => c.entry.work.id === "target");
    expect(n).toBeGreaterThanOrEqual(0);
    const p = candidates[n].passages.findIndex((p) => p.field === "story");
    const result = reviewedResults(
      { matches: [{ n, p }] },
      candidates,
      grouped,
    );
    expect(result.results[0].evidence.text).toBe(story);
    expect(result.results[0].supportingEvidence[0].field).toBe("background");
    expect(result.results[0].supportingEvidence[0].text).toContain("老人");
  });
  it("requires evidence groups and discards a model selection whose quote lacks the required subject", () => {
    expect(() => validatePlan({ contentTerms: ["焚毁"] }, catalog)).toThrow(
      "Missing evidence constraints",
    );
    const { candidates } = retrieveCandidates(catalog, plan, query);
    expect(
      retrieveCandidates(
        catalog,
        { ...plan, evidenceGroups: [["宙斯", "朱庇特"]] },
        query,
      ).candidates,
    ).toHaveLength(0);
    expect(
      reviewedResults({ matches: [{ n: 0, p: 0 }] }, candidates, {
        evidenceGroups: [["宙斯", "朱庇特"]],
      }).results,
    ).toHaveLength(0);
  });
  it("retrieves a work by its story when its title and topic do not contain the query, and preserves source text", () => {
    const { candidates } = retrieveCandidates(catalog, plan, query);
    const n = candidates.findIndex((c) => c.entry.work.id === "target");
    expect(n).toBeGreaterThanOrEqual(0);
    const p = candidates[n].passages.findIndex((p) => p.field === "story");
    const result = reviewedResults(
      { matches: [{ n, p, quote: "model invented this" }] },
      candidates,
    );
    expect(result.results[0]).toEqual({
      id: "target",
      reason: "依据背景故事匹配",
      evidence: {
        field: "story",
        label: "背景故事",
        text: story,
        sources: [source],
      },
    });
    expect(
      candidates.some((c) => ["hidden", "draft"].includes(c.entry.work.id)),
    ).toBe(false);
    expect(reviewMessages(query, candidates)[1].content).toContain(
      "不能据此断言",
    );
    expect(result.total).toBe(1);
  });
  it("enforces explicit artist and location constraints before semantic review", () => {
    expect(
      retrieveCandidates(catalog, { ...plan, places: ["巴黎"] }, query)
        .candidates,
    ).toHaveLength(0);
    const result = retrieveCandidates(
      catalog,
      { ...plan, artistIds: ["m"] },
      query,
    );
    expect(result.candidates.map((c) => c.entry.work.id)).toEqual([
      "distractor",
    ]);
  });
  it("rejects invented candidate or passage references, duplicate selections and mismatched corpus versions", () => {
    const { candidates } = retrieveCandidates(catalog, plan, query);
    for (const matches of [
      [{ n: 999, p: 0 }],
      [{ n: 0, p: -1 }],
      [
        { n: 0, p: 0 },
        { n: 0, p: 0 },
      ],
    ])
      expect(() => reviewedResults({ matches }, candidates)).toThrow();
    expect(() =>
      prepareCatalog(data, revision, { ...corpus, revision: "c".repeat(20) }),
    ).toThrow();
    expect(() =>
      prepareCatalog(data, revision, {
        ...corpus,
        documents: [{ id: "invented", passages: [] }],
      }),
    ).toThrow();
  });
  it("allows plain keyword fallback to search story text, without admitting contextual drafts or unsafe links", () => {
    expect(
      keywordSearch(catalog, "焚毁").results.find((x) => x.id === "target")
        .evidence.text,
    ).toBe(story);
    expect(corpus.documents.some((x) => x.id === "draft")).toBe(false);
    const unsafe = createSearchCorpus(
      {
        artworks: [
          { id: "x", description: story, sourceUrl: "javascript:alert(1)" },
        ],
      },
      revision,
    );
    expect(unsafe.documents[0].passages[0].sources).toEqual([]);
  });
});
const event = {
  rawPath: "/api/ai-search",
  requestContext: { http: { method: "POST", sourceIp: "192.0.2.1" } },
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query, revision }),
};
describe("story search call budget and fallback", () => {
  it("reserves each model call and caches the final grounded response", async () => {
    let clock = 10000;
    const reserve = vi.fn(async () => null);
    const review = vi.fn(async (candidates) => ({
      matches: [
        { n: candidates.findIndex((c) => c.entry.work.id === "target"), p: 0 },
      ],
    }));
    const handler = createHandler({
      getCatalog: async () => catalog,
      plan: async () => plan,
      review,
      reserve,
      now: () => clock,
    });
    const result = JSON.parse((await handler(event, {})).body);
    expect(result.semantic).toBe(true);
    expect(result.results[0].id).toBe("target");
    expect(reserve).toHaveBeenCalledTimes(2);
    expect(review).toHaveBeenCalledTimes(1);
    clock += 1100;
    expect(JSON.parse((await handler(event, {})).body).cached).toBe(true);
    expect(reserve).toHaveBeenCalledTimes(2);
  });
  it("never issues the second paid call if its quota reservation fails", async () => {
    const reserve = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("ip"),
      review = vi.fn();
    const handler = createHandler({
      getCatalog: async () => catalog,
      plan: async () => plan,
      review,
      reserve,
    });
    const result = JSON.parse((await handler(event, {})).body);
    expect(result.mode).toBe("keyword");
    expect(result.message).toContain("仅为关键词匹配");
    expect(review).not.toHaveBeenCalled();
  });
  it("does not expose unverified candidates when review fails or finds no supporting evidence", async () => {
    for (const review of [
      async () => {
        throw new Error("unavailable");
      },
      async () => ({ matches: [] }),
    ]) {
      const handler = createHandler({
        getCatalog: async () => catalog,
        plan: async () => plan,
        review,
        reserve: async () => null,
      });
      const result = JSON.parse((await handler(event, {})).body);
      expect(result.results).toHaveLength(0);
    }
  });
});
