import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useContent } from "../infrastructure/useContent";
import { useSession } from "../application/session";
import {
  scopeWorks,
  scopeLabel,
  workVenues,
  type Artwork,
  type Category,
} from "../domain/atlas";
import { useCompact, useOrientation } from "../platform/usePlatform";
import { Catalog, ArtworkList } from "../features/catalog/Catalog";
import { ArtworkDetails } from "../features/artworks/ArtworkDetails";
import { ArtworkInfoPanel } from "../features/artworks/ArtworkInfoPanel";
import { EmptyState, Icon, IconButton } from "../shared/ui";
import s from "./AtlasApp.module.scss";
const AtlasMap = lazy(() => import("../features/map/AtlasMap"));
const ArtworkViewer = lazy(() => import("../features/viewer/ArtworkViewer"));
export function AtlasApp() {
  const { data, error, retry } = useContent();
  const location = useLocation();
  const navigate = useNavigate();
  const compact = useCompact();
  const search = new URLSearchParams(location.search);
  const scope = search.get("scope") || "category:china";
  const path = location.pathname.split("/").filter(Boolean);
  const isViewer = path[0] === "artworks" && path[2] === "view";
  const isInfo = isViewer && path[3] === "info";
  const isDetail = path[0] === "artworks" && !isViewer;
  const isAllWorks = path[0] === "works";
  const panel = isDetail || isAllWorks;
  const expandedVenue = search.get("venue") || undefined;
  const catalogScene =
    path[0] === "catalog" || path[0] === "topics" || !path[0];
  const scopeDrivenScene = !catalogScene;
  const orientation = useOrientation(
    isViewer || (!catalogScene && !isAllWorks),
  );
  const topicId = useSession((state) => state.topicId);
  const collapsed = useSession((state) => state.collapsed);
  const [focus, setFocus] = useState<{ ids: string[]; nonce: number } | null>(
    null,
  );
  const handleFocus = useCallback(
    (nonce: number) =>
      setFocus((value) => (value?.nonce === nonce ? null : value)),
    [],
  );
  const returnFocus = useRef<HTMLElement | null>(null);
  const dismissingInfo = useRef(false);
  useEffect(() => {
    dismissingInfo.current = false;
  }, [location.key]);
  const works = useMemo(
    () => (data ? scopeWorks(data, scope) : []),
    [data, scope],
  );
  const work = data?.artworks.find((w) => w.id === path[1]);
  const selected =
    isDetail || isViewer ? path[1] : search.get("artwork") || undefined;
  const title = data ? scopeLabel(data, scope) : "名画在哪里";
  const go = useCallback(
    (pathname: string, extra: Record<string, string> = {}, replace = false) => {
      returnFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const query = new URLSearchParams({ scope, ...extra });
      navigate(`${pathname}?${query}`, {
        replace,
        state: replace
          ? location.state
          : {
              depth: (location.state?.depth || 0) + 1,
              from: `${location.pathname}${location.search}`,
            },
      });
    },
    [scope, navigate, location],
  );
  const back = useCallback(() => {
    if (location.state?.depth > 0) navigate(-1);
    else if (isInfo)
      go(
        `/artworks/${path[1]}/view`,
        {
          ...(expandedVenue ? { venue: expandedVenue } : {}),
          ...(search.get("asset") ? { asset: search.get("asset")! } : {}),
        },
        true,
      );
    else if (isViewer || panel) go("/map", {}, true);
    else go(`/catalog/${useSession.getState().tab}`, {}, true);
    requestAnimationFrame(() => {
      const target = isInfo
        ? document.querySelector<HTMLButtonElement>("[data-viewer-info]")
        : returnFocus.current;
      if (target?.isConnected) target.focus({ preventScroll: true });
    });
  }, [location.state, navigate, isInfo, isViewer, panel, go, path, search]);
  const dismissInformation = () => {
    if ((!isInfo && !isDetail) || dismissingInfo.current) return;
    dismissingInfo.current = true;
    const parentPath = location.state?.from?.split("?")[0] as
      string | undefined;
    const viewerPath = `/artworks/${path[1]}/view`;
    const mapParent =
      parentPath === "/map" ||
      (!compact &&
        (parentPath?.startsWith("/catalog/") ||
          parentPath?.startsWith("/topics/")));
    if ((isInfo && parentPath === viewerPath) || (isDetail && mapParent)) {
      // Pop the information entry so closing it adds no extra Back step.
      navigate(-1);
    } else {
      go(
        isInfo ? viewerPath : "/map",
        {
          ...(expandedVenue ? { venue: expandedVenue } : {}),
          ...(isInfo && search.get("asset")
            ? { asset: search.get("asset")! }
            : {}),
        },
        true,
      );
    }
  };
  useEffect(() => {
    if (!path[0])
      navigate("/catalog/china?scope=category:china", { replace: true });
    if (
      path[0] === "catalog" &&
      ["china", "foreign", "topics"].includes(path[1])
    ) {
      useSession.getState().setTab(path[1] as Category);
      if (path[1] === "topics") useSession.getState().setTopic(null);
    }
    if (path[0] === "topics") {
      useSession.getState().setTab("topics");
      useSession.getState().setTopic(path[1]);
    }
  }, [location.pathname, navigate]);
  useEffect(() => {
    // Existing museum links now open their collection directly on the map.
    if (path[0] === "venues" && path[1]) go("/map", { venue: path[1] }, true);
  }, [location.pathname, go]);
  useEffect(() => {
    if (!data || !scopeDrivenScene) return;
    const [kind, id] = scope.split(":");
    if (kind === "artist") {
      const artist = data.artists.find((item) => item.id === id);
      if (!artist) return;
      useSession.setState((state) => ({
        tab: artist.category,
        topicId: null,
        expanded: { ...state.expanded, [artist.category]: artist.periodId },
      }));
    } else if (kind === "topic" && data.topics.some((item) => item.id === id)) {
      useSession.setState({ tab: "topics", topicId: id });
    } else if (kind === "category" && (id === "china" || id === "foreign")) {
      useSession.setState({ tab: id, topicId: null });
    }
  }, [data, scope, scopeDrivenScene]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (panel || isViewer)) {
        event.preventDefault();
        back();
      }
    };
    addEventListener("keydown", handler);
    return () => removeEventListener("keydown", handler);
  }, [panel, isViewer, back]);
  useEffect(() => {
    document.title =
      work && (isDetail || isViewer)
        ? `${work.title} · 名画在哪里`
        : `${title} · 名画在哪里`;
  }, [work, isDetail, isViewer, title]);
  if (!data)
    return (
      <main className={s.app}>
        <div className={s.loading}>
          <img src={`${import.meta.env.BASE_URL}brand/logo.png`} alt="" />
          <h1>名画在哪里</h1>
          {error ? (
            <>
              <p role="alert">{error}</p>
              <button onClick={retry}>重新加载</button>
            </>
          ) : (
            <p role="status">正在整理画作与收藏地…</p>
          )}
        </div>
      </main>
    );
  const openWork = (id: string) =>
    go(
      `/artworks/${id}${compact ? "/view" : ""}`,
      expandedVenue ? { venue: expandedVenue } : {},
    );
  const locate = (ids: string[]) => setFocus({ ids, nonce: Date.now() });
  const selectWork = (item: Artwork) => {
    const venues = workVenues(data, item.id).filter((v) => v.coordinates);
    if (!venues.length) {
      go(`/artworks/${item.id}`);
      return;
    }
    if (compact) go("/map", { artwork: item.id });
    else
      go(
        path[0] === "topics" ? `/topics/${topicId}` : location.pathname,
        { artwork: item.id },
        true,
      );
    locate(venues.map((v) => v.id));
  };
  const showMap = () => {
    const tab = useSession.getState().tab;
    go(
      "/map",
      scope.startsWith("category:") && tab !== "topics"
        ? { scope: `category:${tab}` }
        : {},
    );
    locate([]);
  };
  const renderCatalog = () => (
    <Catalog
      data={data}
      scope={scope}
      compact={compact}
      topicId={topicId}
      selected={selected}
      onTab={(tab) => {
        useSession.getState().setTab(tab);
        go(
          `/catalog/${tab}`,
          tab === "topics" ? {} : { scope: `category:${tab}` },
          true,
        );
      }}
      onArtist={(id) => {
        go("/map", { scope: `artist:${id}` });
        locate([]);
      }}
      onTopic={(id) => {
        useSession.getState().setTopic(id);
        go(`/topics/${id}`, { scope: `topic:${id}` });
        locate([]);
      }}
      onBack={() => {
        useSession.getState().setTopic(null);
        if (location.state?.depth > 0) navigate(-1);
        else go("/catalog/topics", {}, true);
      }}
      onMap={showMap}
      onWork={selectWork}
    />
  );
  const showCatalog = () =>
    go(
      topicId && useSession.getState().tab === "topics"
        ? `/topics/${topicId}`
        : `/catalog/${useSession.getState().tab}`,
    );
  const information = work ? (
    <ArtworkDetails
      data={data}
      work={work}
      assetId={isViewer ? search.get("asset") || undefined : undefined}
      onView={
        isDetail
          ? () =>
              go(
                `/artworks/${work.id}/view`,
                expandedVenue ? { venue: expandedVenue } : {},
              )
          : undefined
      }
      onVenue={(id) => {
        go("/map", { venue: id, artwork: work.id });
      }}
    />
  ) : (
    <EmptyState title="暂未找到这幅作品">
      <button onClick={showCatalog}>返回目录</button>
    </EmptyState>
  );
  const panelTitle = isAllWorks ? `${title} · 作品` : "作品信息";
  return (
    <main
      className={`${s.app} ${compact ? s.compact : s.desktop} ${collapsed && !compact ? s.collapsed : ""}`}
    >
      {!isViewer && (
        <>
          {(!compact || catalogScene) && (
            <div
              id="atlas-catalog"
              className={s.sidebar}
              inert={!compact && collapsed}
              aria-hidden={!compact && collapsed}
            >
              {renderCatalog()}
            </div>
          )}
          {(!compact || !catalogScene) && (
            <section className={s.mapArea} aria-label="探索收藏地">
              {(!compact || !isAllWorks) && (
                <Suspense
                  fallback={
                    <div className={s.mapPlaceholder}>正在展开地图…</div>
                  }
                >
                  <AtlasMap
                    key={scope}
                    data={data}
                    works={works}
                    scope={scope}
                    historyKey={location.key}
                    selected={selected}
                    expandedVenue={expandedVenue}
                    compact={compact}
                    panel={panel}
                    focus={focus}
                    onFocusHandled={handleFocus}
                    onWork={openWork}
                    onVenue={(id) => go("/map", { venue: id })}
                    onVenueCollapse={() => {
                      const query = new URLSearchParams(location.search);
                      query.delete("venue");
                      navigate(`${location.pathname}?${query}`, {
                        replace: true,
                        state: location.state,
                      });
                    }}
                    onOverview={() => {
                      go("/map", {}, true);
                      locate([]);
                    }}
                    onList={() => go("/works")}
                    onCanvasInteraction={
                      isDetail ? dismissInformation : undefined
                    }
                  />
                </Suspense>
              )}
              {!compact && (
                <button
                  className={s.fold}
                  aria-label={collapsed ? "展开目录" : "收起目录"}
                  aria-expanded={!collapsed}
                  aria-controls="atlas-catalog"
                  onClick={() => useSession.getState().setCollapsed(!collapsed)}
                >
                  <Icon name="chevron" size={18} />
                </button>
              )}
              {compact && !panel && (
                <>
                  <header className={s.mapHeader}>
                    <IconButton icon="back" label="返回目录" onClick={back} />
                    <h1>{title}</h1>
                    <IconButton
                      icon="list"
                      label="浏览当前作品"
                      onClick={() => go("/works")}
                    />
                  </header>
                  <div className={s.rotate}>
                    <IconButton
                      icon={orientation.landscape ? "collapse" : "expand"}
                      label={orientation.landscape ? "切换竖屏" : "切换横屏"}
                      onClick={orientation.toggle}
                    />
                  </div>
                </>
              )}
              {isDetail && (
                <ArtworkInfoPanel
                  onClose={back}
                  closeLabel={compact ? "返回上一页" : "关闭详情"}
                >
                  {information}
                </ArtworkInfoPanel>
              )}
              {isAllWorks && (
                <section className={s.panel} aria-label={panelTitle}>
                  <header className={s.panelHeader}>
                    <h2>{panelTitle}</h2>
                    <IconButton
                      icon={compact ? "back" : "close"}
                      label={compact ? "返回上一页" : "关闭详情"}
                      onClick={back}
                    />
                  </header>
                  <div className={s.panelBody}>
                    <p className={s.listCaption}>本项目收录的作品</p>
                    <ArtworkList
                      data={data}
                      works={works}
                      selected={selected}
                      scrollKey={`works:${scope}`}
                      onSelect={(item) =>
                        go(`/artworks/${item.id}${compact ? "/view" : ""}`)
                      }
                    />
                  </div>
                </section>
              )}
            </section>
          )}
        </>
      )}
      {isViewer && work && (
        <Suspense
          fallback={<div className={s.viewerLoading}>正在准备画布…</div>}
        >
          <ArtworkViewer
            data={data}
            work={work}
            assetId={search.get("asset") || undefined}
            compact={compact}
            infoOpen={isInfo}
            landscape={orientation.landscape}
            onBack={back}
            onInfo={() =>
              isInfo
                ? back()
                : go(`/artworks/${work.id}/view/info`, {
                    ...(expandedVenue ? { venue: expandedVenue } : {}),
                    ...(search.get("asset")
                      ? { asset: search.get("asset")! }
                      : {}),
                  })
            }
            onCanvasInteraction={isInfo ? dismissInformation : undefined}
            onRotate={orientation.toggle}
            onAsset={(id) =>
              go(
                `/artworks/${work.id}/view`,
                {
                  ...(expandedVenue ? { venue: expandedVenue } : {}),
                  asset: id,
                },
                true,
              )
            }
          />
        </Suspense>
      )}
      {isViewer && !work && (
        <EmptyState title="暂未找到这幅作品">
          <button onClick={showCatalog}>返回目录</button>
        </EmptyState>
      )}
      {isInfo && (
        <ArtworkInfoPanel onClose={back}>{information}</ArtworkInfoPanel>
      )}
      {orientation.notice && (
        <div className={s.toast} role="status">
          {orientation.notice}
        </div>
      )}
    </main>
  );
}
