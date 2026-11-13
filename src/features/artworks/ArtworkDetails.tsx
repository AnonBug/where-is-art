import {
  artistLabel,
  primaryImage,
  workVenues,
  type Artwork,
  type ArtworkContext,
} from "../../domain/atlas";
import { ArtworkImage, Icon } from "../../shared/ui";
import { ArtworkDownload } from "./ArtworkDownload";
import { ArtworkFavorite } from "./ArtworkFavorite";
import s from "./ArtworkDetails.module.scss";
export function ArtworkDetails({
  data,
  work,
  assetId,
  showPreview = true,
  favorite = false,
  onToggleFavorite,
  storageError = false,
  onView,
  onVenue,
}: {
  data: ArtworkContext;
  work: Artwork;
  assetId?: string;
  showPreview?: boolean;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  storageError?: boolean;
  onView?: () => void;
  onVenue: (id: string) => void;
}) {
  const image =
    data.images.find(
      (image) => image.id === assetId && image.artworkId === work.id,
    ) ?? primaryImage(data, work.id);
  const venues = workVenues(data, work.id);
  // Ignore old contextual payloads too, including cached or shared revisions.
  const guide = work.guide?.scope === "individual" ? work.guide : undefined;
  const background = guide?.background?.trim();
  const story = guide?.story?.trim();
  const looking = guide?.looking?.filter((line) => line.trim()) ?? [];
  const hasReading = !!(background || story || looking.length);
  const description = /^(提香|伦勃朗)相关绘画。/.test(work.description)
    ? work.description.match(/原题：[^。]+。/)?.[0]
    : work.description.trim();
  const knownValue = (value: string) =>
    !/^(年代|媒材|材质)待核实$|^绘画（材料待核实）$/.test(value.trim()) &&
    value.trim();
  const preview = (
    <ArtworkImage
      key={image?.id ?? work.id}
      src={image?.preview.url}
      alt={`${work.title}${!image ? "暂无可用图像" : image.role === "reference" ? "参考图" : image.label}`}
    />
  );
  return (
    <article className={s.details}>
      {showPreview && (
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
      )}
      <div className={s.copy}>
        <h1>{work.title}</h1>
        <p className={s.byline}>
          {[artistLabel(data, work), knownValue(work.dateLabel)]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {knownValue(work.medium) && <p className={s.medium}>{work.medium}</p>}
        {(work.catalogNumber || work.inventoryNumber) && (
          <dl className={s.metadata}>
            {work.catalogNumber && (
              <div>
                <dt>目录编号</dt>
                <dd>{work.catalogNumber}</dd>
              </div>
            )}
            {work.inventoryNumber && (
              <div>
                <dt>馆藏号</dt>
                <dd>{work.inventoryNumber}</dd>
              </div>
            )}
          </dl>
        )}
        {onToggleFavorite && (
          <ArtworkFavorite
            title={work.title}
            favorite={favorite}
            onToggle={onToggleFavorite}
          />
        )}
        {storageError && (
          <p className={s.note} role="status">
            浏览器未允许保存，收藏仅在本次打开期间保留。
          </p>
        )}
        {!image && (
          <p className={s.note}>暂无可用图像，可查看作品资料与收藏位置。</p>
        )}
        {image?.role === "reference" && (
          <p className={s.note}>
            当前展示参考图，图像类型及其与原作的关系见下方说明。
          </p>
        )}
        {hasReading ? (
          <div className={s.reading}>
            {guide?.scopeNote && (
              <p className={s.scopeNote}>{guide.scopeNote}</p>
            )}
            {background && (
              <section>
                <h2>作品背景</h2>
                <p>{background}</p>
              </section>
            )}
            {story && (
              <section>
                <h2>人物与题材</h2>
                <p>{story}</p>
              </section>
            )}
            {!!looking.length && (
              <section>
                <h2>怎么看这幅画</h2>
                <ul>
                  {looking.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ) : (
          description && <p className={s.description}>{description}</p>
        )}
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
        <details className={s.provenance} key={work.id}>
          <summary>来源与版权</summary>
          <p className={s.caption}>地图标示收藏机构，不代表作品正在展出。</p>
          {work.note && <p className={s.note}>{work.note}</p>}
          <div className={s.sources}>
            {hasReading && guide && (
              <div className={s.guideSources}>
                <p>解读参考</p>
                {guide.sources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {source.label} <Icon name="external" size={13} />
                  </a>
                ))}
              </div>
            )}
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
              </>
            )}
          </div>
        </details>
      </div>
    </article>
  );
}
