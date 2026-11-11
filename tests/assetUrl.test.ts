import { afterEach, expect, it, vi } from "vitest";
import { assetUrl } from "../src/domain/atlas";

afterEach(() => vi.unstubAllEnvs());

it.each([undefined, "", "   "])(
  "uses the application base when the asset base is %s",
  (base) => {
    vi.stubEnv("VITE_ASSET_BASE_URL", base);
    vi.stubEnv("BASE_URL", "/where-is-art/");
    expect(assetUrl("catalog.json")).toBe("/where-is-art/catalog.json");
    expect(assetUrl("/assets/mona.jpg")).toBe("/where-is-art/assets/mona.jpg");
    vi.stubEnv("BASE_URL", "/");
    expect(assetUrl("brand/logo.png")).toBe("/brand/logo.png");
  },
);

it.each([
  "https://assets.example/where-is-art",
  " https://assets.example/where-is-art/// ",
])("normalizes slashes without adding the application base to %s", (base) => {
  vi.stubEnv("VITE_ASSET_BASE_URL", base);
  vi.stubEnv("BASE_URL", "/different-app/");
  for (const path of [
    "assets/mona.jpg",
    "/assets/mona.jpg",
    "./assets/mona.jpg",
  ])
    expect(assetUrl(path)).toBe(
      "https://assets.example/where-is-art/assets/mona.jpg",
    );
  expect(assetUrl("media/work/detail.dzi?version=1#image")).toBe(
    "https://assets.example/where-is-art/media/work/detail.dzi?version=1#image",
  );
});

it.each([
  "https://museum.example/image.jpg?size=100#image",
  "http://museum.example/image.jpg",
  "//museum.example/image.jpg",
  "data:image/png;base64,abc",
  "blob:https://museum.example/id",
  "https://assets.example/where-is-art/assets/mona.jpg",
])("preserves an already absolute URL: %s", (url) => {
  vi.stubEnv("VITE_ASSET_BASE_URL", "https://assets.example/where-is-art/");
  expect(assetUrl(url)).toBe(url);
});
