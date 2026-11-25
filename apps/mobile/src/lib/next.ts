export const safeNext = (v: unknown): string | undefined => (typeof v === "string" && /^\/(?![/\\])/.test(v) ? v : undefined);
