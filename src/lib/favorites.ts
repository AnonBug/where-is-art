export const FAVORITES_KEY = "art-atlas-favorites";
export const LEGACY_FAVORITES_KEY = "leonardo-favorites";

export function readFavorites(storage: Pick<Storage, "getItem">) {
  return parseFavorites(
    storage.getItem(FAVORITES_KEY) ?? storage.getItem(LEGACY_FAVORITES_KEY),
  );
}

export function parseFavorites(value: string | null): Set<string> {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return new Set(
      Array.isArray(parsed)
        ? parsed
            .filter(
              (id): id is string => typeof id === "string" && id.length > 0,
            )
            .map((id) =>
              id === "rembrandt-rrp-58" ? "rembrandt-gold-chain" : id,
            )
        : [],
    );
  } catch {
    return new Set();
  }
}
