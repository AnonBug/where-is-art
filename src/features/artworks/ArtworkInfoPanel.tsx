import { useEffect, useRef, type ReactNode } from "react";
import { IconButton } from "../../shared/ui";
import s from "./ArtworkInfoPanel.module.scss";

export function ArtworkInfoPanel({
  children,
  onClose,
  closeLabel = "关闭作品信息",
}: {
  children: ReactNode;
  onClose: () => void;
  closeLabel?: string;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current
      ?.querySelector<HTMLButtonElement>("button")
      ?.focus({ preventScroll: true });
  }, []);

  return (
    <div className={s.overlay}>
      <section
        ref={panel}
        className={s.panel}
        role="dialog"
        aria-label="作品信息"
      >
        <header className={s.header}>
          <h2>作品信息</h2>
          <IconButton icon="close" label={closeLabel} onClick={onClose} />
        </header>
        <div className={s.body}>{children}</div>
      </section>
    </div>
  );
}
