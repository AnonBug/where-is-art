import { artistLabel, type BrowseAtlas } from "../domain/atlas";
import type { AnalyticsPage } from "../infrastructure/analytics";

const categories: Record<string, string> = {
  china: "中国绘画",
  foreign: "外国绘画",
  topics: "专题目录",
  favorites: "我的收藏",
};

// Derive analytics only from known catalog entities. Never send raw URL query
// parameters, search text, favorite IDs, image URLs, or arbitrary route input.
export function analyticsPage(
  data: BrowseAtlas,
  pathname: string,
  search: string,
): AnalyticsPage | undefined {
  const path = pathname.split("/").filter(Boolean);
  const query = new URLSearchParams(search);
  const page = (url: string, title: string) => ({
    url: `/where-is-art/#${url}`,
    title: `${title} · 名画在哪里`,
  });
  if (!path.length || path[0] === "venues") return;
  if (path[0] === "catalog" && categories[path[1]])
    return page(`/catalog/${path[1]}`, categories[path[1]]);
  if (path[0] === "topics") {
    const topic = data.topics.find((item) => item.id === path[1]);
    return topic && page(`/topics/${topic.id}`, `专题｜${topic.title}`);
  }
  if (path[0] === "artworks") {
    const id =
      path[1] === "rembrandt-rrp-58" ? "rembrandt-gold-chain" : path[1];
    const work = data.artworks.find((item) => item.id === id);
    if (!work) return;
    const view = path[2] === "view";
    // Opening the information overlay or changing image detail/zoom stays on
    // the same painting view; a genuine return visit is counted again.
    return page(
      `/artworks/${work.id}${view ? "/view" : ""}`,
      `${view ? "看画" : "作品资料"}｜${work.title}｜${artistLabel(data, work)}`,
    );
  }
  if (path[0] === "map" || path[0] === "works") {
    const scope = query.get("scope") || "category:china";
    const [kind, id] = scope.split(":");
    let label: string | undefined;
    if (scope === "favorites") label = "我的收藏";
    if (kind === "category" && ["china", "foreign"].includes(id))
      label = categories[id];
    if (kind === "artist")
      label = data.artists.find((item) => item.id === id)?.name;
    if (kind === "topic")
      label = data.topics.find((item) => item.id === id)?.title;
    if (!label) return;
    return page(
      `/${path[0]}?scope=${encodeURIComponent(scope === "favorites" ? scope : `${kind}:${id}`)}`,
      `${path[0] === "map" ? "收藏地图" : "作品列表"}｜${label}`,
    );
  }
}
