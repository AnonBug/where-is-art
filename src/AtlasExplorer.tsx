import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AboutDialog } from "./components/AboutDialog";
import { ArtworkDialog } from "./components/ArtworkDialog";
import { FilterSidebar } from "./components/FilterSidebar";
import { GalleryView } from "./components/GalleryView";
import { Header } from "./components/Header";
import { MapView } from "./components/MapView";
import { ViewToolbar } from "./components/ViewToolbar";
import { useWorkHash } from "./hooks/useWorkHash";
import {
  collectionMuseums,
  collectionWorks,
  DEFAULT_FILTERS,
  detailSequence,
  filterWorks,
  sortWorks,
} from "./lib/catalog";
import type {
  AtlasData,
  Collection,
  Filters,
  MapFocus,
  Region,
  SortOrder,
  View,
  Work,
} from "./types";

interface Props {
  data: AtlasData;
  collection: Collection;
  favorites: ReadonlySet<string>;
  storageError: boolean;
  onFavorite: (id: string) => void;
  onNavigate: (id: string | null) => void;
}

export default function AtlasExplorer({
  data,
  collection,
  favorites,
  storageError,
  onFavorite,
  onNavigate,
}: Props) {
  const works = useMemo(
    () => collectionWorks(collection, data.works),
    [collection, data.works],
  );
  const museums = useMemo(
    () => collectionMuseums(works, data.museums),
    [works, data.museums],
  );
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [view, setView] = useState<View>("map");
  const [sort, setSort] = useState<SortOrder>("default");
  const [expanded, setExpanded] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [region, setRegion] = useState<Region>(collection.defaultRegion);
  const [regionRevision, setRegionRevision] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const { workId, openWork, closeWork } = useWorkHash();
  const current = useMemo(
    () => filterWorks(works, museums, filters, favorites, data.artists),
    [works, museums, filters, favorites, data.artists],
  );
  const sorted = useMemo(
    () => sortWorks(current, museums, sort),
    [current, museums, sort],
  );
  const activeWork = works.find((work) => work.id === workId);
  const activeIds = selectedIds.filter((id) =>
    current.some((work) => work.museum === id),
  );
  const featured =
    works.find((work) => work.id === collection.featuredWorkId) ?? works[0];

  const focusMuseums = useCallback(
    (ids: string[]) =>
      setFocus((previous) => ({
        museumIds: ids,
        revision: (previous?.revision ?? 0) + 1,
      })),
    [],
  );
  const selectMuseums = useCallback(
    (ids: string[]) => {
      setSelectedIds(ids);
      if (ids.length === 1) focusMuseums(ids);
    },
    [focusMuseums],
  );

  function changeFilters(changes: Partial<Filters>) {
    setFilters((previous) => ({ ...previous, ...changes }));
    setSelectedIds([]);
  }
  function changeRegion(next: Region) {
    setRegion(next);
    setRegionRevision((value) => value + 1);
    setFocus(null);
  }
  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setSelectedIds([]);
    changeRegion(collection.defaultRegion);
  }
  function locateWork(work: Work) {
    if (!work.museum) return;
    if (!current.some((item) => item.id === work.id))
      setFilters(DEFAULT_FILTERS);
    closeWork();
    setView("map");
    setExpanded(false);
    selectMuseums([work.museum]);
  }

  useEffect(() => {
    let frame = 0;
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !workId &&
        !aboutOpen
      ) {
        event.preventDefault();
        setExpanded(true);
        frame = requestAnimationFrame(() => searchRef.current?.focus());
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleShortcut);
    };
  }, [workId, aboutOpen]);

  const list = {
    works: current,
    museums,
    images: data.images,
    favorites,
    onOpen: openWork,
  };
  return (
    <>
      <Header
        registry={data.registry}
        collectionId={collection.id}
        onNavigate={onNavigate}
        onAbout={() => setAboutOpen(true)}
      />
      <div className="layout">
        <FilterSidebar
          collection={collection}
          works={works}
          museums={museums}
          artists={data.artists}
          filters={filters}
          favoriteCount={works.filter((work) => favorites.has(work.id)).length}
          expanded={expanded}
          searchRef={searchRef}
          onChange={changeFilters}
          onReset={resetFilters}
          onAbout={() => setAboutOpen(true)}
        />
        <main>
          <ViewToolbar
            works={current}
            view={view}
            filtersExpanded={expanded}
            onToggleFilters={() => setExpanded((value) => !value)}
            onChangeView={setView}
          />
          {featured && (
            <MapView
              {...list}
              collection={collection}
              world={data.world}
              visible={view === "map"}
              region={region}
              regionRevision={regionRevision}
              focus={focus}
              selectedIds={activeIds}
              featured={featured}
              onSelect={selectMuseums}
              onZoom={(ids) => {
                focusMuseums(ids);
                setSelectedIds([]);
              }}
              onRegion={changeRegion}
            />
          )}
          <GalleryView
            {...list}
            visible={view === "gallery"}
            sort={sort}
            onSort={setSort}
          />
          <footer>
            <span>{collection.title} · 以馆藏记录为线索，向画作本身靠近。</span>
            <span>
              资料核对 · {collection.updatedAt.replaceAll("-", ".")}{" "}
              <button onClick={() => setAboutOpen(true)}>
                来源与图像说明 ↗
              </button>
            </span>
          </footer>
        </main>
      </div>
      {activeWork && (
        <ArtworkDialog
          key={activeWork.id}
          work={activeWork}
          image={data.images[activeWork.id]}
          museum={activeWork.museum ? museums[activeWork.museum] : undefined}
          artists={data.artists}
          sequence={detailSequence(
            activeWork.id,
            view === "gallery" ? sorted : current,
            works,
          )}
          favorite={favorites.has(activeWork.id)}
          storageError={storageError}
          onClose={closeWork}
          onOpen={openWork}
          onLocate={locateWork}
          onFavorite={onFavorite}
        />
      )}
      {aboutOpen && (
        <AboutDialog
          collection={collection}
          museums={museums}
          onClose={() => setAboutOpen(false)}
        />
      )}
    </>
  );
}
