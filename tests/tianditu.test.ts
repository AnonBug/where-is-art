import { describe, expect, it } from "vitest";
import { createTiandituStyle } from "../src/infrastructure/tianditu";

describe("Tianditu browser integration", () => {
  it("fails closed without credentials and never exposes a malformed value", () => {
    expect(() => createTiandituStyle(undefined)).toThrow("尚未配置");
    expect(() => createTiandituStyle(" ")).toThrow("尚未配置");
    expect(() => createTiandituStyle("private-value")).toThrow("配置格式有误");
    try {
      createTiandituStyle("private-value");
    } catch (error) {
      expect(String(error)).not.toContain("private-value");
    }
  });

  it("uses only official HTTPS WMTS sources with matching Mercator tile coordinates", () => {
    const key = "0".repeat(32);
    const style = createTiandituStyle(` ${key} `);
    expect(Object.keys(style.sources)).toHaveLength(3);
    for (const source of Object.values(style.sources)) {
      if (source.type !== "raster") throw new Error("Expected raster WMTS");
      expect(source.tileSize).toBe(256);
      expect(source.minzoom).toBe(1);
      expect(source.maxzoom).toBe(18);
      expect(source.attribution).toContain("国家基础地理信息中心");
      for (const template of source.tiles ?? []) {
        const url = new URL(
          template
            .replace("{z}", "5")
            .replace("{x}", "26")
            .replace("{y}", "13"),
        );
        expect(url.protocol).toBe("https:");
        expect(url.hostname).toMatch(/^t[0-3]\.tianditu\.gov\.cn$/);
        expect(url.searchParams.get("tk")).toBe(key);
        expect(url.searchParams.get("TILEMATRIXSET")).toBe("w");
        expect(url.searchParams.get("TILEMATRIX")).toBe("5");
        expect(url.searchParams.get("TILECOL")).toBe("26");
        expect(url.searchParams.get("TILEROW")).toBe("13");
      }
    }
  });
});
