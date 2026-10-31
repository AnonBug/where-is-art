import { create } from "zustand";
import type { Category } from "../domain/atlas";
export interface Camera {
  center: [number, number];
  zoom: number;
}
export interface ImageView {
  x: number;
  y: number;
  scale: number;
  home: boolean;
}
interface Session {
  tab: Category;
  expanded: Record<string, string>;
  collapsed: boolean;
  topicId: string | null;
  scroll: Record<string, number>;
  cameras: Record<string, Camera>;
  imageViews: Record<string, ImageView>;
  setTab: (tab: Category) => void;
  togglePeriod: (category: Category, id: string) => void;
  setCollapsed: (value: boolean) => void;
  setTopic: (id: string | null) => void;
  saveScroll: (key: string, value: number) => void;
  saveCamera: (key: string, camera: Camera) => void;
  saveImageView: (key: string, view: ImageView) => void;
}
export const useSession = create<Session>((set) => ({
  tab: "china",
  expanded: { china: "ming", foreign: "renaissance" },
  collapsed: false,
  topicId: null,
  scroll: {},
  cameras: {},
  imageViews: {},
  setTab: (tab) => set({ tab }),
  togglePeriod: (category, id) =>
    set((s) => ({
      expanded: {
        ...s.expanded,
        [category]: s.expanded[category] === id ? "" : id,
      },
    })),
  setCollapsed: (collapsed) => set({ collapsed }),
  setTopic: (topicId) => set({ topicId }),
  saveScroll: (key, value) =>
    set((s) => ({ scroll: { ...s.scroll, [key]: value } })),
  saveCamera: (key, camera) =>
    set((s) => ({ cameras: { ...s.cameras, [key]: camera } })),
  saveImageView: (key, view) =>
    set((s) => ({ imageViews: { ...s.imageViews, [key]: view } })),
}));
