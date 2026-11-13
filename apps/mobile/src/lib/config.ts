import { Platform } from "react-native";
import brand from "./brand";

const DEMO_KEY = "emera.demo";

function readDemo(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("demo");
    if (q === "0" || q === "off") window.sessionStorage.removeItem(DEMO_KEY);
    else if (q !== null) window.sessionStorage.setItem(DEMO_KEY, "1");
    return window.sessionStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
export const DEMO = readDemo();
export const MOCK = API_URL === "" || DEMO;
export const PUBLIC_ORIGIN = API_URL || brand.webOrigin;
