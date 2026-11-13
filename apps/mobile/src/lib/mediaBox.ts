import type { Media } from "./types";

export type Box = { width: number; height: number };

export const FEED = { min: 0.8, max: 1.91, fallback: 0.8 } as const;
export const FULL = { min: 0.5, max: 2.4, fallback: 0.8 } as const;

type Limits = { min: number; max: number; fallback: number };

export function aspect(media: Pick<Media, "width" | "height"> | undefined, limits: Limits): number {
  const raw = media?.width && media.height ? media.width / media.height : limits.fallback;
  return Math.min(limits.max, Math.max(limits.min, raw));
}

export function fitBox(ratio: number, room: Box): Box {
  const width = Math.max(1, Math.round(Math.min(room.width, room.height * ratio)));
  return { width, height: Math.max(1, Math.round(Math.min(width / ratio, room.height))) };
}

export const feedBox = (media: Media | undefined, width: number): Box => ({ width, height: Math.round(width / aspect(media, FEED)) });
