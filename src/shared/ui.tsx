import {
  useState,
  type ButtonHTMLAttributes,
  type ImgHTMLAttributes,
} from "react";
import { assetUrl } from "../domain/atlas";
import s from "./ui.module.scss";

const paths = {
  back: "m12 19-7-7 7-7M5 12h14",
  close: "M18 6 6 18M6 6l12 12",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  chevron: "m9 18 6-6-6-6",
  down: "m6 9 6 6 6-6",
  info: "M12 16v-4M12 8h.01",
  map: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15",
  expand:
    "M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3",
  collapse:
    "M8 3v3a2 2 0 0 1-2 2H3m13-5v3a2 2 0 0 0 2 2h3M3 16h3a2 2 0 0 1 2 2v3m8 0v-3a2 2 0 0 1 2-2h3",
  reset: "M3 11a9 9 0 1 1 2.7 6.4M3 4v7h7",
  external:
    "M15 3h6v6m0-6L10 14M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4",
  layers: "m12 3 10 6-10 6L2 9l10-6ZM2 15l10 6 10-6",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
};
export type IconName = keyof typeof paths;
export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "info" && <circle cx="12" cy="12" r="9" />}
      <path d={paths[name]} />
    </svg>
  );
}
export function IconButton({
  icon,
  label,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${s.iconButton} ${className}`}
      {...props}
    >
      <Icon name={icon} />
    </button>
  );
}
export function ArtworkImage({
  src,
  alt,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);
  return failed || !src ? (
    <span
      className={s.imageFallback}
      role="img"
      aria-label={alt || "图片暂不可用"}
    >
      <Icon name="layers" />
    </span>
  ) : (
    <img
      {...props}
      src={assetUrl(src)}
      alt={alt}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={s.empty}>
      <Icon name="layers" size={32} />
      <p>{title}</p>
      {children}
    </div>
  );
}
