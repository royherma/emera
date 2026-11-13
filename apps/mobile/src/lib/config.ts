import brand from "./brand";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
export const MOCK = API_URL === "";
export const PUBLIC_ORIGIN = API_URL || brand.webOrigin;
