import type { View, Work } from "../types";

interface Props {
  works: Work[];
  view: View;
  filtersExpanded: boolean;
  onToggleFilters: () => void;
  onChangeView: (view: View) => void;
}

export function ViewToolbar({
  works,
  view,
  filtersExpanded,
  onToggleFilters,
  onChangeView,
}: Props) {
  const mapped = works.filter((work) => work.museum).length;
  const unknown = works.length - mapped;
  return (
    <div className="toolbar">
      <button
        className="mobile-filter"
        aria-expanded={filtersExpanded}
        aria-controls="sidebar"
        onClick={onToggleFilters}
      >
        筛选条件
      </button>
      <div className="result" aria-live="polite">
        <strong id="resultCount">{works.length} 件作品</strong>
        <span>
          {mapped} 件有已知收藏地{unknown > 0 && ` · ${unknown} 件位置未确认`}
        </span>
      </div>
      <div className="view-tabs" aria-label="浏览视图">
        <button
          id="mapTab"
          className={view === "map" ? "active" : ""}
          aria-pressed={view === "map"}
          onClick={() => onChangeView("map")}
        >
          ◎ 地图
        </button>
        <button
          id="galleryTab"
          className={view === "gallery" ? "active" : ""}
          aria-pressed={view === "gallery"}
          onClick={() => onChangeView("gallery")}
        >
          ▦ 图录
        </button>
      </div>
    </div>
  );
}
