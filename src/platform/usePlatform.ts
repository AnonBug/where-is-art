import { useEffect, useState } from "react";

export function useCompact() {
  const query = "(max-width: 1023px), (pointer: coarse)";
  const [compact, setCompact] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return compact;
}
export function useOrientation(active: boolean) {
  const [landscape, setLandscape] = useState(() => innerWidth > innerHeight);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const update = () => setLandscape(innerWidth > innerHeight);
    addEventListener("resize", update);
    screen.orientation?.addEventListener("change", update);
    return () => {
      removeEventListener("resize", update);
      screen.orientation?.removeEventListener("change", update);
    };
  }, []);
  useEffect(() => {
    if (!active) {
      screen.orientation?.unlock?.();
      if (document.fullscreenElement?.hasAttribute("data-atlas-fullscreen"))
        void document.exitFullscreen().catch(() => {});
    }
  }, [active]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(timer);
  }, [notice]);
  async function toggle() {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (value: string) => Promise<void>;
    };
    try {
      if (!orientation?.lock) throw new Error();
      const root = document.documentElement;
      if (!document.fullscreenElement && root.requestFullscreen) {
        root.setAttribute("data-atlas-fullscreen", "");
        await root.requestFullscreen();
      }
      await orientation.lock(landscape ? "portrait" : "landscape");
    } catch {
      setNotice("请旋转设备");
    }
  }
  return { landscape, notice, toggle };
}
