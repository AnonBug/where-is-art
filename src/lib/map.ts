import type { Museums, Work } from "../types";

export interface MuseumGroup {
  ids: string[];
  works: Work[];
  point: { x: number; y: number };
  lat: number;
  lng: number;
}

export function clusterMuseums(
  museums: Museums,
  works: Work[],
  project: (lat: number, lng: number) => { x: number; y: number },
  radius = 40,
): MuseumGroup[] {
  const groups: MuseumGroup[] = [];
  for (const [id, museum] of Object.entries(museums)) {
    const selected = works.filter((work) => work.museum === id);
    if (!selected.length) continue;
    const point = project(museum.lat, museum.lng);
    let group = groups.find(
      (candidate) =>
        Math.hypot(point.x - candidate.point.x, point.y - candidate.point.y) <
        radius,
    );
    if (!group) {
      group = { ids: [], works: [], point, lat: museum.lat, lng: museum.lng };
      groups.push(group);
    }
    group.ids.push(id);
    group.works.push(...selected);
  }
  return groups;
}
