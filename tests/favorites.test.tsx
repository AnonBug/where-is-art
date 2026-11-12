// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useFavorites } from "../src/hooks/useFavorites";
import {
  FAVORITES_KEY,
  LEGACY_FAVORITES_KEY,
  parseFavorites,
} from "../src/lib/favorites";
import { atlasSchema, scopeWorks } from "../src/domain/atlas";
import catalog from "../public/catalog.json";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("migrates legacy favorites, keeps unknown IDs, and persists rapid changes after remount", () => {
  localStorage.setItem(
    LEGACY_FAVORITES_KEY,
    '["mona","rembrandt-rrp-58","unknown-work"]',
  );
  const first = renderHook(() => useFavorites());
  expect([...first.result.current.favorites]).toEqual([
    "mona",
    "rembrandt-gold-chain",
    "unknown-work",
  ]);
  act(() => {
    first.result.current.toggleFavorite("mona");
    first.result.current.toggleFavorite("ermine");
    first.result.current.toggleFavorite("mona");
  });
  first.unmount();
  const next = renderHook(() => useFavorites());
  expect([...next.result.current.favorites]).toEqual([
    "rembrandt-gold-chain",
    "unknown-work",
    "ermine",
    "mona",
  ]);
  expect(next.result.current.storageError).toBe(false);
  expect(localStorage.getItem(LEGACY_FAVORITES_KEY)).toContain(
    "rembrandt-rrp-58",
  );
});

it("merges another tab's latest change, syncs storage events and handles clearing website data", () => {
  const { result } = renderHook(() => useFavorites());
  localStorage.setItem(FAVORITES_KEY, '["mona"]');
  act(() => result.current.toggleFavorite("ermine"));
  expect([...result.current.favorites]).toEqual(["mona", "ermine"]);
  localStorage.setItem(FAVORITES_KEY, '["ermine"]');
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: FAVORITES_KEY,
        storageArea: localStorage,
      }),
    ),
  );
  expect([...result.current.favorites]).toEqual(["ermine"]);
  localStorage.clear();
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", { key: null, storageArea: localStorage }),
    ),
  );
  expect(result.current.favorites.size).toBe(0);
});

it("preserves session favorites after storage failure and retries saving on the next change", () => {
  localStorage.setItem(FAVORITES_KEY, '["mona"]');
  const { result } = renderHook(() => useFavorites());
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new DOMException("Unavailable", "QuotaExceededError");
    });
  act(() => result.current.toggleFavorite("ermine"));
  act(() =>
    window.dispatchEvent(new StorageEvent("storage", { key: FAVORITES_KEY })),
  );
  expect([...result.current.favorites]).toEqual(["mona", "ermine"]);
  expect(result.current.storageError).toBe(true);
  act(() => result.current.toggleFavorite("mona"));
  expect([...result.current.favorites]).toEqual(["ermine"]);
  write.mockRestore();
  act(() => result.current.toggleFavorite("mona"));
  expect(JSON.parse(localStorage.getItem(FAVORITES_KEY)!)).toEqual([
    "ermine",
    "mona",
  ]);
  expect(result.current.storageError).toBe(false);
});

it("still allows session favorites when storage access itself is blocked", () => {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new DOMException("Blocked", "SecurityError");
  });
  const { result } = renderHook(() => useFavorites());
  act(() => result.current.toggleFavorite("mona"));
  expect([...result.current.favorites]).toEqual(["mona"]);
  expect(result.current.storageError).toBe(true);
});

it("deduplicates merged artwork IDs and omits invalid data", () => {
  expect([
    ...parseFavorites('["",42,null,"rembrandt-rrp-58","rembrandt-gold-chain"]'),
  ]).toEqual(["rembrandt-gold-chain"]);
});

it("lists known saved works newest first, including records without an image", () => {
  const data = atlasSchema.parse(catalog);
  const unavailable = data.artworks.find(
    (work) => work.imageStatus === "unavailable",
  )!;
  expect(unavailable).toBeTruthy();
  expect(
    scopeWorks(
      data,
      "favorites",
      new Set(["mona", "unknown-work", unavailable.id]),
    ).map((work) => work.id),
  ).toEqual([unavailable.id, "mona"]);
});
