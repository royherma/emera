import { Platform, Share } from "react-native";
import * as Clipboard from "expo-clipboard";

export async function shareLink(url: string, message?: string): Promise<"shared" | "copied"> {
  if (Platform.OS !== "web") {
    try {
      await Share.share(Platform.OS === "ios" ? { url, message } : { message: `${message ? message + " " : ""}${url}` });
      return "shared";
    } catch {}
  }
  await Clipboard.setStringAsync(url);
  return "copied";
}

export async function copyText(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

export function confirmAsk(title: string, body: string, ok: string, onOk: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${body}`)) onOk();
    return;
  }
  const { Alert } = require("react-native") as typeof import("react-native");
  Alert.alert(title, body, [{ text: "Cancel", style: "cancel" }, { text: ok, style: "destructive", onPress: onOk }]);
}
