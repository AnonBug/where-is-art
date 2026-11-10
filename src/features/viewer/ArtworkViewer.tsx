import { useEffect, useRef, useState } from "react";
import OpenSeadragon from "openseadragon";
import { useSession, type ImageView } from "../../application/session";
import {
  artistLabel,
  assetUrl,
  primaryImage,
  type Artwork,
  type Atlas,
} from "../../domain/atlas";
import { ArtworkImage, IconButton } from "../../shared/ui";
import { ArtworkDownload } from "../artworks/ArtworkDownload";
import s from "./ArtworkViewer.module.scss";
interface Props {
  data: Atlas;
  work: Artwork;
  assetId?: string;
  compact: boolean;
  infoOpen: boolean;
  landscape: boolean;
  onBack: () => void;
  onInfo: () => void;
  onCanvasInteraction?: () => void;
  onRotate: () => void;
  onAsset: (id: string) => void;
}
export default function ArtworkViewer({
  data,
  work,
  assetId,
  compact,
  infoOpen,
  landscape,
  onBack,
  onInfo,
  onCanvasInteraction,
  onRotate,
  onAsset,
}: Props) {
  const images = data.images
    .filter((image) => image.artworkId === work.id)
    .sort((a, b) => a.order - b.order);
  const asset =
    images.find((image) => image.id === assetId) ?? primaryImage(data, work.id);
  const stage = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const viewer = useRef<OpenSeadragon.Viewer | null>(null);
  const [hasImage, setHasImage] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(100);
  const [attempt, setAttempt] = useState(0);
  const [picker, setPicker] = useState(false);
  useEffect(() => {
    if (!stage.current || !asset) return;
    setHasImage(false);
    setError("");
    let dead = false;
    let hasCanvasImage = false;
    let detail: OpenSeadragon.TiledImage | undefined;
    const snapshotKey = `${work.id}:${asset.id}`;
    const previous = useSession.getState().imageViews[snapshotKey];
    const imageSource = {
      type: "image",
      url: assetUrl(asset.delivery.url),
      buildPyramid: false,
    };
    const v = OpenSeadragon({
      element: stage.current,
      // One preview tile uses the final image's coordinate system. The canvas
      // can open immediately, with identical pan/zoom limits at either quality.
      tileSources: {
        width: asset.delivery.width,
        height: asset.delivery.height,
        tileSize: Math.max(asset.delivery.width, asset.delivery.height),
        minLevel: 0,
        maxLevel: 0,
        getTileUrl: () => assetUrl(asset.preview.url),
      },
      showNavigationControl: false,
      showNavigator: false,
      homeFillsViewer: false,
      visibilityRatio: 0.85,
      constrainDuringPan: true,
      maxZoomPixelRatio: asset.quality === "standard" ? 1 : 1.5,
      minZoomImageRatio: 0.8,
      imageLoaderLimit: compact ? 3 : 6,
      maxImageCacheCount: compact ? 40 : 90,
      loadTilesWithAjax: true,
      timeout: 15000,
      animationTime: 0.2,
      blendTime: 0.1,
      gestureSettingsMouse: {
        scrollToZoom: true,
        clickToZoom: false,
        dblClickToZoom: true,
      },
      gestureSettingsTouch: {
        pinchToZoom: true,
        clickToZoom: false,
        dblClickToZoom: true,
        flickEnabled: false,
      },
      viewportMargins: {
        top: compact ? 84 : 70,
        bottom: 88,
        left: 16,
        right: 16,
      },
    });
    viewer.current = v;
    function updateZoomLimit() {
      // 100% means fit-to-window. Allow at least 400% even for small images,
      // while retaining the higher native-resolution limit of detailed works.
      // The runtime exposes this option, but @types omits it from Viewport.
      const viewport = v.viewport as OpenSeadragon.Viewport & {
        maxZoomLevel: number | undefined;
      };
      viewport.maxZoomLevel = undefined;
      viewport.maxZoomLevel = Math.max(
        viewport.getMaxZoom(),
        viewport.getHomeZoom() * 4,
      );
    }
    function capture(): ImageView | undefined {
      const item = v.world.getItemAt(0);
      if (!item) return;
      const size = item.getContentSize();
      const point = item.viewportToImageCoordinates(v.viewport.getCenter(true));
      return {
        x: point.x / size.x,
        y: point.y / size.y,
        scale: item.viewportToImageZoom(v.viewport.getZoom(true)),
        home:
          Math.abs(v.viewport.getZoom(true) / v.viewport.getHomeZoom() - 1) <
          0.015,
      };
    }
    function restore(state: ImageView) {
      const item = v.world.getItemAt(0);
      if (!item) return;
      if (state.home) {
        v.viewport.goHome(true);
        return;
      }
      const size = item.getContentSize();
      v.viewport.zoomTo(item.imageToViewportZoom(state.scale), undefined, true);
      v.viewport.panTo(
        item.imageToViewportCoordinates(state.x * size.x, state.y * size.y),
        true,
      );
      v.viewport.applyConstraints(true);
    }
    function updateZoom() {
      if (dead) return;
      setZoom(
        Math.round((v.viewport.getZoom(true) / v.viewport.getHomeZoom()) * 100),
      );
    }
    function save() {
      if (dead) return;
      const state = capture();
      if (state) useSession.getState().saveImageView(snapshotKey, state);
      updateZoom();
    }
    const timer = setTimeout(() => {
      if (!dead && !hasCanvasImage) setError("画作加载较慢，可以稍候或重试。");
    }, 15000);
    v.addHandler("open", () => {
      if (dead) return;
      updateZoomLimit();
      if (previous) restore(previous);
      else v.viewport.goHome(true);
      save();
      // Add detail over the interactive preview without reopening the viewer
      // or restoring an old viewport. Unloaded tiles keep showing the preview.
      v.addTiledImage({
        tileSource:
          asset.delivery.kind === "dzi"
            ? assetUrl(asset.delivery.url)
            : imageSource,
        x: 0,
        y: 0,
        width: 1,
        success: () => {
          if (!dead) {
            detail = v.world.getItemAt(1);
            updateZoomLimit();
          }
        },
        error: () => {
          if (!dead) setError("高清图暂时无法加载，可继续浏览预览。");
        },
      });
    });
    v.addHandler("update-viewport", () => {
      if (dead) return;
      // Follow the rendered scale during gestures and animation, while saving
      // the session view only when the interaction finishes.
      updateZoom();
      // This event runs after drawing, so the static first frame disappears
      // only when an interactive image is actually on screen.
      const detailReady = detail?.getFullyLoaded();
      if (hasCanvasImage && !detailReady) return;
      if (v.world.getItemAt(0)?.getFullyLoaded() || detailReady) {
        hasCanvasImage = true;
        clearTimeout(timer);
        setHasImage(true);
        setError((value) =>
          detailReady || value.startsWith("画作加载较慢") ? "" : value,
        );
      }
    });
    v.addHandler("open-failed", () => {
      if (!dead) {
        clearTimeout(timer);
        setError("画作暂时无法加载，请重试。");
      }
    });
    v.addHandler("tile-load-failed", ({ tiledImage }) => {
      if (!dead && tiledImage === detail)
        setError("部分高清细节未能加载，可继续浏览或重试。");
    });
    v.addHandler("animation-finish", save);
    v.addHandler("canvas-drag-end", (event) => {
      if (event.pointerType !== "touch") return;
      // Stop at the displayed position instead of finishing the pan spring
      // after the finger lifts. Zoom animations keep their own spring.
      v.viewport.panTo(v.viewport.getCenter(true), true);
      v.viewport.applyConstraints(true);
      save();
    });
    const observer = new ResizeObserver(() => {
      const element = stage.current;
      if (!element || !element.clientWidth || !element.clientHeight) return;
      const state = capture();
      v.viewport.resize(
        new OpenSeadragon.Point(element.clientWidth, element.clientHeight),
        true,
      );
      updateZoomLimit();
      if (state) restore(state);
    });
    observer.observe(stage.current);
    return () => {
      const state = capture();
      if (state) useSession.getState().saveImageView(snapshotKey, state);
      dead = true;
      clearTimeout(timer);
      observer.disconnect();
      v.destroy();
      viewer.current = null;
    };
  }, [asset, work.id, compact, attempt]);
  useEffect(() => {
    if (!infoOpen) {
      root.current
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus({ preventScroll: true });
    }
    // Opening/closing information must not steal focus during a canvas gesture.
  }, [work.id]);
  function changeZoom(factor: number) {
    const v = viewer.current;
    if (!v) return;
    v.viewport.zoomBy(factor);
    v.viewport.applyConstraints();
  }
  return (
    <div
      ref={root}
      className={s.viewer}
      role="dialog"
      aria-modal={infoOpen ? undefined : true}
      aria-label={`欣赏${work.title}`}
      onKeyDown={(event) => {
        if (!infoOpen && event.key === "Tab") {
          const controls = [
            ...(root.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled), a[href], select",
            ) ?? []),
          ].filter((el) => el.offsetParent !== null);
          const first = controls[0],
            last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <div className={s.preview} hidden={hasImage}>
        <ArtworkImage key={asset?.id} src={asset?.preview.url} alt="" />
      </div>
      <div
        ref={stage}
        className={s.stage}
        onPointerDownCapture={onCanvasInteraction}
        onWheelCapture={onCanvasInteraction}
      />
      <header className={s.header}>
        <IconButton
          icon={compact ? "back" : "close"}
          label="退出看画"
          onClick={onBack}
        />
        <div>
          <h1>{work.title}</h1>
          {!compact && (
            <p>
              {artistLabel(data, work)} · {work.dateLabel}
            </p>
          )}
        </div>
        <div className={s.headerActions}>
          <ArtworkDownload work={work} image={asset} iconOnly />
          <IconButton
            icon="info"
            label="查看作品信息"
            onClick={onInfo}
            data-viewer-info
          />
        </div>
      </header>
      {!asset && (
        <div className={s.error} role="status">
          暂无可用图像，可通过作品信息查看资料与收藏位置。
        </div>
      )}
      {error && (
        <div className={s.error} role="status">
          <span>{error}</span>
          <button onClick={() => setAttempt((n) => n + 1)}>重试</button>
        </div>
      )}
      {asset && (
        <div className={s.toolbar}>
          <IconButton
            icon="minus"
            label="缩小画作"
            onClick={() => changeZoom(1 / 1.35)}
          />
          <span>{zoom}%</span>
          <IconButton
            icon="plus"
            label="放大画作"
            onClick={() => changeZoom(1.35)}
          />
          <i />
          <IconButton
            icon="expand"
            label="还原全图"
            onClick={() => viewer.current?.viewport.goHome()}
          />
        </div>
      )}
      {images.length > 1 && (
        <div className={s.parts}>
          <button
            onClick={() => setPicker((value) => !value)}
            aria-expanded={picker}
          >
            {asset?.label}
            <span>⌃</span>
          </button>
          {picker && (
            <div className={s.picker} aria-label="选择全卷或高清局部">
              {images.map((image) => (
                <button
                  key={image.id}
                  aria-current={asset?.id === image.id ? "true" : undefined}
                  onClick={() => {
                    onAsset(image.id);
                    setPicker(false);
                  }}
                >
                  {image.label}
                </button>
              ))}
              <p>包含全幅、分段、局部或题跋；每张图片不另计为作品。</p>
            </div>
          )}
        </div>
      )}
      {compact && (
        <div className={s.rotate}>
          <IconButton
            icon={landscape ? "collapse" : "expand"}
            label={landscape ? "切换竖屏" : "切换横屏"}
            onClick={onRotate}
          />
        </div>
      )}
      {asset?.quality === "standard" && (
        <span className={s.resolution}>普通清晰度</span>
      )}
      {asset?.role === "reference" && asset.quality !== "standard" && (
        <span className={s.resolution}>局部参考图</span>
      )}
    </div>
  );
}
