import { useRef, type CSSProperties } from "react";
import {
  primaryImage,
  type BrowseAtlas,
  type ArtworkSummary,
  type VenueSummary,
} from "../../domain/atlas";
import { ArtworkImage } from "../../shared/ui";
import s from "./VenueMarker.module.scss";

interface Props {
  data: BrowseAtlas;
  venue: VenueSummary;
  works: ArtworkSummary[];
  selected?: string;
  expanded: boolean;
  showLabel: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onWork: (id: string) => void;
}

export function VenueMarker({
  data,
  venue,
  works,
  selected,
  expanded,
  showLabel,
  onExpand,
  onCollapse,
  onWork,
}: Props) {
  const preview = works.find((work) => work.id === selected) ?? works[0];
  const visibleWorks = expanded ? works : preview ? [preview] : [];
  const active = expanded || works.some((work) => work.id === selected);
  const pin = useRef<HTMLButtonElement>(null);
  const collapse = () => {
    pin.current?.focus({ preventScroll: true });
    onCollapse();
  };

  return (
    <div
      className={`${s.marker} ${active ? s.selected : ""} ${expanded ? s.expanded : ""}`}
      data-venue-id={venue.id}
      data-expanded={expanded}
    >
      <div
        className={s.collection}
        style={
          {
            "--columns": Math.min(4, Math.ceil(Math.sqrt(visibleWorks.length))),
            "--work-count": visibleWorks.length,
          } as CSSProperties
        }
      >
        {expanded && (
          <div className={s.collectionHeader}>
            <span title={venue.name}>
              {venue.name}
              <small>{works.length} 幅</small>
            </span>
            <button
              type="button"
              onClick={collapse}
              aria-label={`收起${venue.name}的作品`}
            >
              收起 <span aria-hidden="true">×</span>
            </button>
          </div>
        )}
        <div
          className={s.thumbnails}
          role="group"
          aria-label={`${venue.name}的作品`}
          onWheel={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
        >
          {visibleWorks.map((work) => (
            <button
              key={work.id}
              className={work.id === selected ? s.activeWork : undefined}
              onClick={() => onWork(work.id)}
              aria-label={`查看${work.title}`}
              title={work.title}
            >
              <div className={s.image}>
                <ArtworkImage
                  src={primaryImage(data, work.id)?.thumbnail.url}
                  alt=""
                />
              </div>
              {expanded && <span className={s.caption}>{work.title}</span>}
            </button>
          ))}
        </div>
      </div>
      <button
        ref={pin}
        className={s.pin}
        aria-label={`${venue.name}，当前范围 ${works.length} 幅作品，${expanded ? "收起作品" : "展开作品"}`}
        aria-expanded={expanded}
        onClick={expanded ? collapse : onExpand}
      />
      {(showLabel || expanded) && (
        <button
          className={s.label}
          onClick={expanded ? collapse : onExpand}
          title={venue.name}
          aria-expanded={expanded}
        >
          {venue.name}
          <span>· {works.length}</span>
          <span className={s.chevron} aria-hidden="true">
            {expanded ? "⌃" : "⌄"}
          </span>
        </button>
      )}
    </div>
  );
}
