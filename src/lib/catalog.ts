import type {
  Artist,
  Collection,
  Filters,
  Museums,
  SortOrder,
  Work,
} from "../types";

export const DEFAULT_FILTERS: Filters = {
  query: "",
  kind: "全部",
  country: "全部",
  theme: "全部",
  artist: "全部",
  favoritesOnly: false,
};

export function filterWorks(
  works: Work[],
  museums: Museums,
  filters: Filters,
  favorites: ReadonlySet<string>,
  artists: Record<string, Artist> = {},
) {
  const query = filters.query.trim().toLowerCase();
  return works.filter((work) => {
    const museum = work.museum ? museums[work.museum] : undefined;
    const searchable = [
      work.title,
      work.en,
      work.description,
      work.medium,
      museum?.name,
      museum?.city,
      museum?.country,
      ...work.artistIds.map(
        (id) => `${artists[id]?.name ?? ""} ${artists[id]?.en ?? ""}`,
      ),
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!query || searchable.includes(query)) &&
      (filters.kind === "全部" || work.kind === filters.kind) &&
      (filters.country === "全部" ||
        (museum?.country ?? "位置未确认") === filters.country) &&
      (filters.theme === "全部" || work.theme === filters.theme) &&
      (filters.artist === "全部" || work.artistIds.includes(filters.artist)) &&
      (!filters.favoritesOnly || favorites.has(work.id))
    );
  });
}

export function collectionWorks(collection: Collection, allWorks: Work[]) {
  const byId = new Map(allWorks.map((work) => [work.id, work]));
  return collection.workIds
    .map((id) => byId.get(id))
    .filter((work): work is Work => Boolean(work));
}

export function collectionMuseums(works: Work[], museums: Museums): Museums {
  const ids = new Set(
    works.map((work) => work.museum).filter((id): id is string => Boolean(id)),
  );
  return Object.fromEntries(
    [...ids].filter((id) => museums[id]).map((id) => [id, museums[id]]),
  );
}

export function workLocation(work: Work, museums: Museums) {
  const museum = work.museum ? museums[work.museum] : undefined;
  return museum ? `${museum.city} · ${museum.name}` : "私人收藏 · 位置未确认";
}

export function sortWorks(works: Work[], museums: Museums, order: SortOrder) {
  const result = [...works];
  if (order === "date")
    result.sort(
      (a, b) =>
        (a.startYear ?? Number(a.date.match(/\d{3,4}/)?.[0] ?? Infinity)) -
        (b.startYear ?? Number(b.date.match(/\d{3,4}/)?.[0] ?? Infinity)),
    );
  if (order === "museum")
    result.sort((a, b) =>
      workLocation(a, museums).localeCompare(workLocation(b, museums), "zh-CN"),
    );
  return result;
}

export function detailSequence(workId: string, filtered: Work[], all: Work[]) {
  return filtered.some((work) => work.id === workId) ? filtered : all;
}
