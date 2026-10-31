import type { RefObject } from "react";
import type { Catalog, Collection, Filters } from "../types";

interface Props extends Catalog {
  collection: Collection;
  filters: Filters;
  favoriteCount: number;
  expanded: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  onChange: (changes: Partial<Filters>) => void;
  onReset: () => void;
  onAbout: () => void;
}

function FilterChips({
  title,
  value,
  values,
  counts,
  onChange,
}: {
  title: string;
  value: string;
  values: string[];
  counts?: Record<string, number>;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend>{title}</legend>
      <div className="chips">
        {["全部", ...values].map((option) => (
          <button
            key={option}
            type="button"
            className={value === option ? "active" : ""}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {option}
            {counts?.[option] !== undefined && <small>{counts[option]}</small>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function FilterSidebar({
  collection,
  works,
  museums,
  artists,
  filters,
  favoriteCount,
  expanded,
  searchRef,
  onChange,
  onReset,
  onAbout,
}: Props) {
  const countries = [
    ...new Set(Object.values(museums).map((museum) => museum.country)),
  ];
  const kinds = [...new Set(works.map((work) => work.kind))];
  const counts = Object.fromEntries(
    kinds.map((kind) => [
      kind,
      works.filter((work) => work.kind === kind).length,
    ]),
  );
  const artistIds = [...new Set(works.flatMap((work) => work.artistIds))];
  return (
    <aside className={`sidebar${expanded ? " open" : ""}`} id="sidebar">
      <div className="intro">
        <span className="eyebrow">{collection.eyebrow}</span>
        <h1>
          {collection.introTitle.map((line, index) => (
            <span key={line}>
              {index > 0 && <br />}
              {line}
            </span>
          ))}
        </h1>
        <p>{collection.introDescription}</p>
        <div className="stats">
          <div>
            <b>{works.length}</b>
            <small>收录作品</small>
          </div>
          <div>
            <b>{Object.keys(museums).length}</b>
            <small>收藏机构</small>
          </div>
          <div>
            <b>{countries.length}</b>
            <small>国家</small>
          </div>
        </div>
      </div>
      <div className="filters">
        <label className="search">
          <span aria-hidden="true">⌕</span>
          <input
            ref={searchRef}
            id="search"
            type="search"
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            placeholder="搜索画名、城市、博物馆…"
            aria-label="搜索画作或收藏地点"
          />
          <kbd>⌘ K</kbd>
        </label>
        <div className="filter-title">
          <strong>探索馆藏</strong>
          <button onClick={onReset}>重置条件</button>
        </div>
        <FilterChips
          title="作品归属"
          value={filters.kind}
          values={kinds}
          counts={counts}
          onChange={(kind) => onChange({ kind })}
        />
        {artistIds.length > 1 && (
          <fieldset>
            <legend>相关艺术家</legend>
            <select
              aria-label="筛选艺术家"
              value={filters.artist}
              onChange={(event) => onChange({ artist: event.target.value })}
            >
              <option value="全部">全部艺术家</option>
              {artistIds.map((id) => (
                <option key={id} value={id}>
                  {artists[id]?.name ?? id}
                </option>
              ))}
            </select>
          </fieldset>
        )}
        <FilterChips
          title="收藏国家"
          value={filters.country}
          values={[...countries, "位置未确认"]}
          onChange={(country) => onChange({ country })}
        />
        <FilterChips
          title="画作主题"
          value={filters.theme}
          values={[...new Set(works.map((work) => work.theme))]}
          onChange={(theme) => onChange({ theme })}
        />
        <label className="favorite-check">
          <input
            type="checkbox"
            checked={filters.favoritesOnly}
            onChange={(event) =>
              onChange({ favoritesOnly: event.target.checked })
            }
          />
          只看我收藏的作品 <span>{favoriteCount}</span>
        </label>
      </div>
      <div className="sidebar-bottom">
        <span className="tiny-dot" />
        <p>
          地图展示收藏归属，非实时展出位置。
          <br />
          <button onClick={onAbout}>收录范围与归属说明 ↗</button>
        </p>
      </div>
    </aside>
  );
}
