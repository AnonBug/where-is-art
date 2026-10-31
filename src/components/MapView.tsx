import { useAtlasMap } from "../hooks/useAtlasMap";
import type { Collection, MapFocus, Region, Work, WorldMap } from "../types";
import { ArtworkShelf } from "./ArtworkShelf";
import type { ArtworkListProps } from "./ArtworkList";
import { MuseumPanel } from "./MuseumPanel";

interface Props extends ArtworkListProps {
  collection: Collection;
  world: WorldMap;
  visible: boolean;
  region: Region;
  regionRevision: number;
  focus: MapFocus | null;
  selectedIds: string[];
  featured: Work;
  onSelect: (ids: string[]) => void;
  onZoom: (ids: string[]) => void;
  onRegion: (region: Region) => void;
}

export function MapView({
  collection,
  world,
  visible,
  region,
  regionRevision,
  focus,
  selectedIds,
  featured,
  onSelect,
  onZoom,
  onRegion,
  ...list
}: Props) {
  const containerRef = useAtlasMap({
    world,
    ...list,
    region,
    regionRevision,
    focus,
    visible,
    onSelect,
  });
  const unknown = list.works.filter((work) => !work.museum);
  const selectedMuseum =
    selectedIds.length === 1 ? list.museums[selectedIds[0]] : null;
  const shelfWorks = selectedMuseum
    ? list.works.filter((work) => work.museum === selectedIds[0])
    : list.works;
  const featuredMuseum = featured.museum ? list.museums[featured.museum] : null;
  return (
    <section id="mapView" hidden={!visible} aria-label="名画收藏分布">
      <div className="map-wrapper">
        <div id="map" ref={containerRef} aria-label="可缩放和拖动的收藏地图" />
        <div className="map-heading">
          <span>收藏的地理</span>
          <p>{collection.mapHint}</p>
        </div>
        <div className="region-switch">
          {collection.defaultRegion === "europe" && (
            <button
              className={region === "europe" ? "selected" : ""}
              aria-pressed={region === "europe"}
              onClick={() => onRegion("europe")}
            >
              欧洲
            </button>
          )}
          <button
            className={region === "collection" ? "selected" : ""}
            aria-pressed={region === "collection"}
            onClick={() => onRegion("collection")}
          >
            本专题
          </button>
          <button
            className={region === "world" ? "selected" : ""}
            aria-pressed={region === "world"}
            onClick={() => onRegion("world")}
          >
            世界
          </button>
        </div>
        <button className="spotlight" onClick={() => list.onOpen(featured.id)}>
          <img src={list.images[featured.id].path} alt={featured.title} />
          <span>
            <small>今日，从这里出发</small>
            <strong className="spotlight-title">{featured.title}</strong>
            <span className="spotlight-location">
              {featuredMuseum
                ? `${featuredMuseum.country} · ${featuredMuseum.city} · ${featuredMuseum.name}`
                : "位置未确认"}
            </span>
            <span className="text-link">走近这幅画 ↗</span>
          </span>
        </button>
        <div className="map-legend">
          <span>
            <i />
            收藏地点聚合 · 数字为当前筛选作品数
          </span>
          {unknown.length > 0 && (
            <button onClick={() => list.onOpen(unknown[0].id)}>
              ？位置未确认 <b>{unknown.length}</b>
            </button>
          )}
        </div>
        <MuseumPanel
          ids={selectedIds}
          works={list.works}
          museums={list.museums}
          images={list.images}
          onOpen={list.onOpen}
          onClose={() => onSelect([])}
          onZoom={onZoom}
        />
      </div>
      <ArtworkShelf
        {...list}
        works={shelfWorks}
        title={
          selectedMuseum
            ? `${selectedMuseum.name.split(" · ")[0]}的作品`
            : "从一幅画开始"
        }
      />
    </section>
  );
}
