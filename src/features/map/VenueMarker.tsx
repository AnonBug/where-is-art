import type { CSSProperties } from "react";
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
  onWork,
}: Props) {
  const preview = works.find((work) => work.id === selected) ?? works[0];
  const visibleWorks = expanded ? works : preview ? [preview] : [];
  const active = expanded || works.some((work) => work.id === selected);

  return (
    <div
      className={`${s.marker} ${active ? s.selected : ""} ${expanded ? s.expanded : ""}`}
      data-venue-id={venue.id}
      data-expanded={expanded}
    >
      <div
        className={s.thumbnails}
        role="group"
        aria-label={`${venue.name}的作品`}
        onWheel={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        style={
          {
            "--columns": Math.min(4, Math.ceil(Math.sqrt(visibleWorks.length))),
          } as CSSProperties
        }
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
      <button
        className={s.pin}
        aria-label={`${venue.name}，当前范围 ${works.length} 幅作品，放大并展开作品`}
        aria-expanded={expanded}
        onClick={onExpand}
      />
      {(showLabel || expanded) && (
        <button
          className={s.label}
          onClick={onExpand}
          title={venue.name}
          aria-expanded={expanded}
        >
          {venue.name}
          <span>· {works.length}</span>
        </button>
      )}
    </div>
  );
}
