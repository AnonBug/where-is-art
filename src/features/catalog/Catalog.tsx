import { useLayoutEffect, useRef } from "react";
import { useSession } from "../../application/session";
import {
  artistLabel,
  primaryImage,
  scopeWorks,
  type Artwork,
  type Atlas,
  type Category,
} from "../../domain/atlas";
import { ArtworkImage, Icon, IconButton } from "../../shared/ui";
import s from "./Catalog.module.scss";

export function ArtworkList({
  data,
  works,
  selected,
  onSelect,
  scrollKey,
}: {
  data: Atlas;
  works: Artwork[];
  selected?: string;
  onSelect: (work: Artwork) => void;
  scrollKey: string;
}) {
  const ref = useSavedScroll(scrollKey);
  return (
    <div ref={ref} className={s.workList} aria-label="作品列表">
      {works.map((work) => (
        <button
          key={work.id}
          className={`${s.workRow} ${selected === work.id ? s.selected : ""}`}
          aria-current={selected === work.id ? "true" : undefined}
          onClick={() => onSelect(work)}
        >
          <span className={s.thumb}>
            <ArtworkImage
              src={primaryImage(data, work.id)?.thumbnail.url}
              alt=""
              loading="lazy"
            />
          </span>
          <span className={s.workCopy}>
            <strong>{work.title}</strong>
            <small>
              {artistLabel(data, work)} ·{" "}
              {data.artists.find((a) => a.id === work.artistIds[0])
                ?.category === "china"
                ? "明"
                : data.artists.find((a) => a.id === work.artistIds[0])
                    ?.countryLabel}
            </small>
          </span>
          <Icon name="chevron" size={16} />
        </button>
      ))}
    </div>
  );
}
export function useSavedScroll(key: string) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = useSession.getState().scroll[key] ?? 0;
    return () => {
      useSession.getState().saveScroll(key, el.scrollTop);
    };
  }, [key]);
  return ref;
}
interface Props {
  data: Atlas;
  scope: string;
  topicId: string | null;
  selected?: string;
  onTab: (tab: Category) => void;
  onArtist: (id: string) => void;
  onTopic: (id: string) => void;
  onBack: () => void;
  onMap: () => void;
  onWork: (work: Artwork) => void;
  compact: boolean;
}
export function Catalog({
  data,
  scope,
  topicId,
  selected,
  onTab,
  onArtist,
  onTopic,
  onBack,
  onMap,
  onWork,
  compact,
}: Props) {
  const tab = useSession((state) => state.tab);
  const expanded = useSession((state) => state.expanded[tab]);
  const topic = data.topics.find((t) => t.id === topicId);
  const topicWorks = topic ? scopeWorks(data, `topic:${topic.id}`) : [];
  const scrollRef = useSavedScroll(`catalog:${tab}`);
  const pendingPeriod = useRef<{
    element: HTMLElement;
    id: string;
    tab: Category;
  } | null>(null);
  useLayoutEffect(() => {
    const target = pendingPeriod.current;
    pendingPeriod.current = null;
    const directory = scrollRef.current;
    if (
      compact &&
      target &&
      target.id === expanded &&
      target.tab === tab &&
      directory?.contains(target.element)
    ) {
      // Measure the section after the previous one has collapsed. The heading
      // itself may already be sticky, so its position cannot locate the section.
      directory.scrollTop +=
        target.element.getBoundingClientRect().top -
        directory.getBoundingClientRect().top -
        directory.clientTop;
      return;
    }
    if (
      !scope.startsWith("artist:") ||
      useSession.getState().scroll[`catalog:${tab}`] !== undefined
    )
      return;
    scrollRef.current
      ?.querySelector<HTMLElement>('button[aria-current="true"]')
      ?.scrollIntoView?.({ block: "nearest" });
  }, [scope, tab, expanded, scrollRef, compact]);
  return (
    <aside className={s.catalog} aria-label="名画目录">
      <div className={s.brand}>
        <img
          src={`${import.meta.env.BASE_URL}brand/logo.png`}
          alt="珍珠耳环猫 Logo"
        />
        <span>名画在哪里</span>
        {compact && (
          <IconButton icon="map" label="查看当前分布" onClick={onMap} />
        )}
      </div>
      <nav className={s.tabs} aria-label="目录分类">
        {(
          [
            ["china", "中国"],
            ["foreign", "外国"],
            ["topics", "专题"],
          ] as const
        ).map(([id, name]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => onTab(id)}
            className={tab === id ? s.activeTab : ""}
          >
            {name}
          </button>
        ))}
      </nav>
      {tab === "topics" && topic ? (
        <>
          <div className={s.topicHeader}>
            <button className={s.backText} onClick={onBack}>
              <Icon name="back" size={17} />
              返回专题
            </button>
            <div>
              <h1>{topic.title}</h1>
              <IconButton icon="map" label="查看专题整体分布" onClick={onMap} />
            </div>
            <p>{topicWorks.length} 幅作品</p>
          </div>
          <ArtworkList
            data={data}
            works={topicWorks}
            selected={selected}
            onSelect={onWork}
            scrollKey={`topic:${topic.id}`}
          />
        </>
      ) : (
        <div ref={scrollRef} className={s.directory}>
          {tab === "topics"
            ? data.topics.map((topic) => (
                <button
                  key={topic.id}
                  className={s.topic}
                  onClick={() => onTopic(topic.id)}
                >
                  <span>
                    <strong>{topic.title}</strong>
                    <small>{topic.description}</small>
                  </span>
                  <Icon name="chevron" size={18} />
                </button>
              ))
            : data.periods
                .filter((period) => period.category === tab)
                .map((period) => (
                  <section
                    key={period.id}
                    className={`${s.period} ${expanded === period.id ? s.expandedPeriod : ""}`}
                  >
                    <button
                      className={s.periodHeading}
                      aria-expanded={expanded === period.id}
                      onClick={(event) => {
                        pendingPeriod.current =
                          compact && expanded !== period.id
                            ? {
                                element: event.currentTarget.parentElement!,
                                id: period.id,
                                tab,
                              }
                            : null;
                        useSession.getState().togglePeriod(tab, period.id);
                      }}
                    >
                      <Icon
                        name={expanded === period.id ? "down" : "chevron"}
                        size={13}
                      />
                      <span className={s.folderIcon}>
                        <Icon name="folder" size={18} />
                      </span>
                      <span className={s.periodCopy}>
                        <strong>{period.name}</strong>
                        <small>{period.dateLabel}</small>
                      </span>
                    </button>
                    {expanded === period.id && (
                      <div className={s.artists}>
                        {data.artists
                          .filter((artist) => artist.periodId === period.id)
                          .map((artist) => (
                            <button
                              key={artist.id}
                              className={`${s.artist} ${scope === `artist:${artist.id}` ? s.selected : ""}`}
                              aria-current={
                                scope === `artist:${artist.id}`
                                  ? "true"
                                  : undefined
                              }
                              onClick={() => onArtist(artist.id)}
                            >
                              <Icon name="artist" size={15} />
                              <span className={s.artistCopy}>
                                <strong>{artist.name}</strong>
                                <small>
                                  {artist.lifeLabel}
                                  {tab === "foreign" &&
                                    ` · ${artist.countryLabel}`}
                                </small>
                              </span>
                            </button>
                          ))}
                      </div>
                    )}
                  </section>
                ))}
        </div>
      )}
      <div className={s.footnote}>
        <span>循着画作，走近收藏之地</span>
        <span className={s.dot} /> <span>持续收录中</span>
      </div>
    </aside>
  );
}
