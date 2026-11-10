import type { Artwork, ImageAsset } from "../../domain/atlas";
import { artworkDownload } from "../../domain/artworkDownload";
import { Icon } from "../../shared/ui";
import s from "./ArtworkDownload.module.scss";

export function ArtworkDownload({
  work,
  image,
  iconOnly = false,
  className = "",
}: {
  work: Artwork;
  image?: ImageAsset;
  iconOnly?: boolean;
  className?: string;
}) {
  const download = artworkDownload(work, image);
  if (!download) return null;
  return (
    <a
      className={`${iconOnly ? s.iconDownload : s.download} ${className}`}
      href={download.href}
      download={download.filename}
      aria-label={`${download.label}：${work.title} · ${image!.label}`}
      title={`${download.label} · ${download.description}`}
    >
      <Icon name="download" size={22} />
      {!iconOnly && (
        <span>
          <strong>{download.label}</strong>
          <small>{download.description}</small>
        </span>
      )}
    </a>
  );
}
