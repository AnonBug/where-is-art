import { Icon } from "../../shared/ui";
import s from "./ArtworkFavorite.module.scss";

export function ArtworkFavorite({
  title,
  favorite,
  onToggle,
  iconOnly = false,
}: {
  title: string;
  favorite: boolean;
  onToggle: () => void;
  iconOnly?: boolean;
}) {
  const label = `${favorite ? "取消收藏" : "收藏"}《${title}》`;
  return (
    <button
      type="button"
      className={`${s.favorite} ${iconOnly ? s.iconOnly : ""}`}
      aria-label={label}
      aria-pressed={favorite}
      title={label}
      onClick={onToggle}
    >
      <Icon name="heart" size={iconOnly ? 22 : 18} />
      {!iconOnly && <span>{favorite ? "已收藏" : "收藏这幅画"}</span>}
    </button>
  );
}
