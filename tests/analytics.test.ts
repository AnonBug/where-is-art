// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "../public/catalog.json";
import { atlasSchema } from "../src/domain/atlas";
import { analyticsPage } from "../src/application/analyticsPage";

const data = atlasSchema.parse(catalog);
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("PROD", true);
  vi.stubEnv("VITE_UMAMI_WEBSITE_ID", "test-website");
  vi.stubEnv("VITE_UMAMI_SCRIPT_URL", "https://analytics.example/script.js");
  vi.stubEnv("VITE_UMAMI_DOMAINS", location.hostname);
  localStorage.clear();
});
afterEach(() => {
  document.getElementById("art-analytics")?.remove();
  delete window.umami;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("canonical analytics pages", () => {
  it("groups viewer overlays, assets and unrelated query parameters into the same painting", () => {
    const plain = analyticsPage(data, "/artworks/mona/view", "");
    expect(
      analyticsPage(
        data,
        "/artworks/mona/view/info",
        "?asset=detail&scope=topic:leonardo&secret=private",
      ),
    ).toEqual(plain);
    expect(plain?.title).toContain("蒙娜丽莎");
    expect(plain?.url).toBe("/where-is-art/#/artworks/mona/view");
    expect(
      analyticsPage(data, "/artworks/missing-private-input", ""),
    ).toBeUndefined();
  });
  it("distinguishes artist and topic maps without sending arbitrary routes or favorite contents", () => {
    const artist = data.artists[0];
    expect(
      analyticsPage(data, "/map", `?scope=artist:${artist.id}&venue=somewhere`)
        ?.title,
    ).toContain(artist.name);
    const topic = data.topics[0];
    expect(analyticsPage(data, `/topics/${topic.id}`, "")?.title).toContain(
      topic.title,
    );
    expect(
      analyticsPage(data, "/catalog/favorites", "?artwork=mona")?.url,
    ).toBe("/where-is-art/#/catalog/favorites");
    expect(
      analyticsPage(data, "/map", "?scope=artist:private-input"),
    ).toBeUndefined();
    expect(analyticsPage(data, "/", "")).toBeUndefined();
  });
});

async function ready() {
  const payloads: Record<string, unknown>[] = [];
  window.umami = {
    track: vi.fn((make) => {
      payloads.push(
        make({
          website: "test-website",
          url: "/?private=query",
          title: "stale",
          referrer: "https://ref.example/?private=1",
        }),
      );
      return Promise.resolve();
    }),
  };
  document.getElementById("art-analytics")!.dispatchEvent(new Event("load"));
  return payloads;
}

describe("delivery", () => {
  const page = { url: "/where-is-art/catalog/china", title: "中国绘画" };
  it("sends the first view after script loading, deduplicates re-renders, and counts a real return", async () => {
    const { trackPage } = await import("../src/infrastructure/analytics");
    trackPage(page);
    trackPage({ ...page });
    const script = document.getElementById("art-analytics")!;
    expect(script.dataset.autoTrack).toBe("false");
    expect(document.querySelectorAll("#art-analytics")).toHaveLength(1);
    const payloads = await ready();
    await vi.waitFor(() => expect(payloads).toHaveLength(1));
    trackPage({ url: "/where-is-art/artworks/mona/view", title: "蒙娜丽莎" });
    trackPage(page);
    await vi.waitFor(() => expect(payloads).toHaveLength(3));
    expect(payloads.map((p) => p.url)).toEqual([
      page.url,
      "/where-is-art/artworks/mona/view",
      page.url,
    ]);
    expect(JSON.stringify(payloads)).not.toContain("private");
    expect(payloads[2].referrer).toBe("/where-is-art/artworks/mona/view");
  });
  it("captures an event on its originating page even when navigation races script loading", async () => {
    const { trackPage, trackDownload, trackSearch } =
      await import("../src/infrastructure/analytics");
    trackPage(page);
    trackDownload({ id: "mona", title: "蒙娜丽莎" });
    trackSearch("ai", 2);
    trackPage({ url: "/next", title: "Next" });
    const payloads = await ready();
    await vi.waitFor(() => expect(payloads).toHaveLength(4));
    expect(payloads[1]).toMatchObject({
      url: page.url,
      name: "image_download",
      data: { artwork: "蒙娜丽莎 [mona]" },
    });
    expect(payloads[2]).toMatchObject({
      name: "search_complete",
      data: { mode: "ai", results: 2 },
    });
  });
  it.each(["development", "hostname", "disabled", "no-config", "dnt"])(
    "does not load the script for %s",
    async (reason) => {
      if (reason === "development") vi.stubEnv("PROD", false);
      if (reason === "hostname")
        vi.stubEnv("VITE_UMAMI_DOMAINS", "other.example");
      if (reason === "disabled") localStorage.setItem("umami.disabled", "1");
      if (reason === "no-config") vi.stubEnv("VITE_UMAMI_WEBSITE_ID", "");
      if (reason === "dnt") vi.stubGlobal("navigator", { doNotTrack: "1" });
      const { trackPage } = await import("../src/infrastructure/analytics");
      trackPage(page);
      expect(document.getElementById("art-analytics")).toBeNull();
    },
  );
  it("drops queued events after opt-out and tolerates a blocked script", async () => {
    const { trackPage, disableAnalytics } =
      await import("../src/infrastructure/analytics");
    trackPage(page);
    disableAnalytics();
    const payloads = await ready();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(payloads).toHaveLength(0);
    trackPage({ url: "/next", title: "Next" });
    expect(payloads).toHaveLength(0);
  });
  it("keeps browsing safe when the tracker rejects", async () => {
    const { trackPage } = await import("../src/infrastructure/analytics");
    trackPage(page);
    window.umami = { track: vi.fn().mockRejectedValue(new Error("blocked")) };
    document.getElementById("art-analytics")!.dispatchEvent(new Event("load"));
    await vi.waitFor(() =>
      expect(window.umami!.track).toHaveBeenCalledTimes(1),
    );
    trackPage({ url: "/next", title: "Next" });
    await vi.waitFor(() =>
      expect(window.umami!.track).toHaveBeenCalledTimes(2),
    );
  });
});
