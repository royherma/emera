import { StyleProp, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { Art } from "./Art";
import { Icon } from "./Icon";
import { Glass } from "./ui";
import { useTheme } from "@/state/theme";
import { sun, type } from "@/lib/theme";
import { Text } from "react-native";
import type { Media } from "@/lib/types";

export function MediaImage({ media, style, fit = "cover", playSize = 48 }: { media: Media; style?: StyleProp<ViewStyle>; fit?: "cover" | "contain"; playSize?: number }) {
  const { c } = useTheme();
  const art = media.url.startsWith("mock:");
  return (
    <View style={[{ overflow: "hidden", backgroundColor: c.sunk }, style]}>
      {art ? <Art seed={media.url} /> : media.kind === "video" ? <View style={{ flex: 1, backgroundColor: "#140f0b" }} /> : <Image source={{ uri: media.url }} alt={media.alt || undefined} style={{ width: "100%", height: "100%" }} contentFit={fit} transition={180} />}
      {media.kind === "video" && (
        <View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" }}>
          <Glass style={{ width: playSize, height: playSize, borderRadius: playSize / 2, paddingLeft: 3 }}>
            <Icon name="play" size={playSize * 0.45} color="#fff" />
          </Glass>
        </View>
      )}
    </View>
  );
}

export function SignedMark({ compact = false }: { compact?: boolean }) {
  return (
    <Glass style={{ height: compact ? 20 : 26, paddingHorizontal: compact ? 0 : 10, paddingLeft: compact ? 0 : 7, width: compact ? 20 : undefined, borderRadius: 99, gap: 5 }}>
      <Icon name="shield" size={compact ? 12 : 14} color={sun.sunHigh} strokeWidth={2} />
      {!compact && <Text style={[type.label, { color: "#fff", fontSize: 11, letterSpacing: 0.1 }]}>Signed</Text>}
    </Glass>
  );
}

export function IndexChip({ index, total }: { index: number; total: number }) {
  return (
    <Glass style={{ height: 24, paddingHorizontal: 9, borderRadius: 99, gap: 5 }}>
      <Icon name="layers" size={13} color="#fff" strokeWidth={2} />
      <Text style={[type.label, { color: "#fff", fontSize: 11, letterSpacing: 0.1 }]}>
        {index}/{total}
      </Text>
    </Glass>
  );
}

function RealVideo({ url, style }: { url: string; style?: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
  });
  return <VideoView player={player} style={[{ backgroundColor: "#000" }, style]} nativeControls contentFit="contain" />;
}

export function MediaFull({ media, style }: { media: Media; style?: StyleProp<ViewStyle> }) {
  if (media.kind === "video" && !media.url.startsWith("mock:")) return <RealVideo url={media.url} style={style} />;
  return <MediaImage media={media} style={style} fit="contain" playSize={60} />;
}
