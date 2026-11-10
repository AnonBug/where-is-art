import {
  artistLabel,
  primaryImage,
  workVenues,
  type Artwork,
  type Atlas,
} from "../../domain/atlas";
import { ArtworkImage, Icon } from "../../shared/ui";
import { ArtworkDownload } from "./ArtworkDownload";
import s from "./ArtworkDetails.module.scss";
export function ArtworkDetails({
  data,
  work,
  assetId,
  onView,
  onVenue,
}: {
  data: Atlas;
  work: Artwork;
  assetId?: string;
  onView?: () => void;
  onVenue: (id: string) => void;
}) {
  const image =
    data.images.find(
      (image) => image.id === assetId && image.artworkId === work.id,
    ) ?? primaryImage(data, work.id);
  const venues = workVenues(data, work.id);
  const preview = (
    <ArtworkImage
      key={image?.id ?? work.id}
      src={image?.preview.url}
      alt={`${work.title}${!image ? "暂无可用图像" : image.role === "reference" ? "参考图" : image.label}`}
    />
  );
  return (
    <article className={s.details}>
      <div className={s.previewContainer}>
        {onView && image ? (
          <button
            className={s.preview}
            onClick={onView}
            aria-label={`放大欣赏${work.title}`}
          >
            {preview}
            <span className={s.viewAction}>
              <Icon name="expand" size={15} /> 放大欣赏
            </span>
          </button>
        ) : (
          <div className={`${s.preview} ${s.staticPreview}`}>{preview}</div>
        )}
        <ArtworkDownload
          work={work}
          image={image}
          iconOnly
          className={s.previewDownload}
        />
      </div>
      <div className={s.copy}>
        <h1>{work.title}</h1>
        <p className={s.byline}>
          {artistLabel(data, work)} · {work.dateLabel}
        </p>
        <p className={s.medium}>{work.medium}</p>
        {!image && (
          <p className={s.note}>暂无可用图像，可查看作品资料与收藏位置。</p>
        )}
        {image?.role === "reference" && (
          <p className={s.note}>当前展示局部或分段参考图，不是完整长卷。</p>
        )}
        <p className={s.description}>{work.description}</p>
        {work.note && <p className={s.note}>{work.note}</p>}
        <div className={s.venues}>
          {venues.length ? (
            venues.map((venue) => (
              <button
                key={venue.id}
                onClick={() => onVenue(venue.id)}
                disabled={!venue.coordinates}
              >
                <span>
                  <strong>{venue.name}</strong>
                  <small>
                    {venue.city} · {venue.country}
                    {!venue.coordinates && " · 地点待核实"}
                  </small>
                </span>
                {venue.coordinates && <Icon name="map" size={20} />}
              </button>
            ))
          ) : (
            <p className={s.note}>收藏地点待核实，暂不在地图上定位。</p>
          )}
        </div>
        <p className={s.caption}>地图标示收藏机构，不代表作品正在展出。</p>
        <div className={s.sources}>
          <a href={work.sourceUrl} target="_blank" rel="noreferrer">
            作品资料来源 <Icon name="external" size={13} />
          </a>
          {image && (
            <>
              <a href={image.sourceUrl} target="_blank" rel="noreferrer">
                图像来源 <Icon name="external" size={13} />
              </a>
              <p>{image.credit}</p>
              {image.licenseUrl ? (
                <a href={image.licenseUrl} target="_blank" rel="noreferrer">
                  {image.licenseLabel}
                </a>
              ) : (
                <p>{image.licenseLabel}</p>
              )}
              {image.quality === "standard" && (
                <p>
                  当前为普通清晰度图像，{image.width} × {image.height} 像素。
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
