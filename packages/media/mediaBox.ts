export type Box = { width: number; height: number };
export type Sized = { width?: number | null; height?: number | null };

export const FEED = { min: 0.8, max: 1.91, fallback: 0.8 } as const;
export const FULL = { min: 0.5, max: 2.4, fallback: 0.8 } as const;
export const CARD = { width: 1200, height: 630, pad: 40, coverFrom: 1.2 } as const;

type Limits = { min: number; max: number; fallback: number };

export function aspect(media: Sized | undefined, limits: Limits): number {
  const raw = media?.width && media.height ? media.width / media.height : limits.fallback;
  return Math.min(limits.max, Math.max(limits.min, raw));
}

export function fitBox(ratio: number, room: Box): Box {
  const width = Math.max(1, Math.round(Math.min(room.width, room.height * ratio)));
  return { width, height: Math.max(1, Math.round(Math.min(width / ratio, room.height))) };
}

export const feedBox = (media: Sized | undefined, width: number): Box => ({ width, height: Math.round(width / aspect(media, FEED)) });

export const feedColumn = (column: number, screenHeight: number, chrome: number) => Math.min(column, Math.round(Math.max(360, screenHeight - chrome) * FEED.min));

export type CardLayout = { mode: "cover" } | { mode: "framed"; frame: Box & { x: number; y: number } };

// Portrait and square media in a 1.9:1 link card: show the whole frame, never a middle-band crop that cuts faces.
export function cardLayout(media: Sized | undefined): CardLayout {
  const ratio = aspect(media, FULL);
  if (ratio >= CARD.coverFrom) return { mode: "cover" };
  const box = fitBox(ratio, { width: CARD.width / 2, height: CARD.height - CARD.pad * 2 });
  return { mode: "framed", frame: { ...box, x: CARD.width - CARD.pad - box.width, y: Math.round((CARD.height - box.height) / 2) } };
}
