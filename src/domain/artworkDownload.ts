import { assetUrl, type Artwork, type ImageAsset } from "./atlas";

export function artworkDownload(work: Artwork, image?: ImageAsset) {
  if (!image) return undefined;
  const original = image.delivery.kind === "image";
  const resource = original ? image.delivery : image.preview;
  const format =
    resource.url.split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1] ?? "jpg";
  const subject =
    image.role === "whole"
      ? "全图"
      : image.role === "reference"
        ? "参考图"
        : "局部图";
  const label = original
    ? `下载${image.role === "whole" ? "原图" : subject}`
    : `下载${subject}（低清）`;
  const filename =
    `${work.title}-${image.label}-${original ? "原图" : "低清预览"}`
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .trim();
  return {
    href: assetUrl(resource.url),
    filename: `${filename}.${format}`,
    label,
    description: `${resource.width} × ${resource.height} · ${format.toUpperCase()}`,
  };
}
