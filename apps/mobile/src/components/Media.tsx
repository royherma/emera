import { StyleProp, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { Art } from "./Art";
import { Icon } from "./Icon";
import { colors } from "@/lib/theme";
import type { Media } from "@/lib/types";

export function MediaImage({ media, style, fit = "cover" }: { media: Media; style?: StyleProp<ViewStyle>; fit?: "cover" | "contain" }) {
  const art = media.url.startsWith("mock:");
  return (
    <View style={[{ overflow: "hidden", backgroundColor: colors.sunk }, style]}>
      {art ? <Art seed={media.url} /> : media.kind === "video" ? <View style={{ flex: 1, backgroundColor: colors.ink }} /> : <Image source={{ uri: media.url }} style={{ width: "100%", height: "100%" }} contentFit={fit} transition={180} />}
      {media.kind === "video" && (
        <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 52, height: 52, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.38)", alignItems: "center", justifyContent: "center", paddingLeft: 3 }}>
            <Icon name="play" size={22} color="#fff" />
          </View>
        </View>
      )}
    </View>
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
  return <MediaImage media={media} style={style} fit="contain" />;
}
