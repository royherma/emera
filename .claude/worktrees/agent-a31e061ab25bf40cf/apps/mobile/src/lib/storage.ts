import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      return Platform.OS === "web" ? window.localStorage.getItem(key) : await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string | null): Promise<void> {
    try {
      if (Platform.OS === "web") {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      } else if (value === null) await SecureStore.deleteItemAsync(key);
      else await SecureStore.setItemAsync(key, value);
    } catch {}
  },
};
