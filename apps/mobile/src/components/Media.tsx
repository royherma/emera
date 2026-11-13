import { type ComponentRef, createElement, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Dimensions, Platform, Pressable, StyleProp, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEvent } from "expo";
import { Art } from "./Art";
import { Icon } from "./Icon";
import { Glass } from "./ui";
import { useTheme } from "@/state/theme";
import { sun, type } from "@/lib/theme";
import { Text } from "react-native";
import type { Media } from "@/lib/types";
import { storage } from "@/lib/storage";

export function MediaImage({ media, style, fit = "cover", playSize = 48 }: { media: Media; style?: StyleProp<ViewStyle>; fit?: "cover" | "contain"; playSize?: number }) {
  const { c } = useTheme();
  const art = media.url.startsWith("mock:");
  return (
    <View style={[{ overflow: "hidden", backgroundColor: c.sunk }, style]}>
      {art ? <Art seed={media.url} /> : media.kind === "video" ? <VideoStill media={media} fit={fit} /> : <Image source={{ uri: media.url }} alt={media.alt || undefined} style={{ width: "100%", height: "100%" }} contentFit={fit} transition={180} />}
      {media.kind === "video" && playSize > 0 && (
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

const web = Platform.OS === "web";
const full = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const;
// expo-video on web hands this style to a raw <video>, which ignores insets and keeps its file size without width/height.
const fill = { ...full, width: "100%", height: "100%" } as const;

function VideoStill({ media, fit }: { media: Media; fit: "cover" | "contain" }) {
  if (media.posterUrl) return <Image source={{ uri: media.posterUrl }} alt={media.alt || undefined} style={{ width: "100%", height: "100%" }} contentFit={fit} transition={180} />;
  if (web) return createElement("video", { src: `${media.url}#t=0.5`, preload: "metadata", muted: true, playsInline: true, style: { width: "100%", height: "100%", objectFit: fit, display: "block", backgroundColor: "#140f0b" } });
  return <View style={{ flex: 1, backgroundColor: "#140f0b" }} />;
}

const SOUND_KEY = "emera.sound";
let soundOn = false;
let unlocked = !web;
const soundListeners = new Set<() => void>();
const notify = () => soundListeners.forEach((l) => l());
const effectiveSound = () => soundOn && unlocked;
function setSound(on: boolean) {
  soundOn = on;
  unlocked = true;
  notify();
  void storage.set(SOUND_KEY, on ? "on" : null);
}
void storage.get(SOUND_KEY).then((v) => {
  if (v === "on") (soundOn = true), notify();
});
function useSound() {
  return useSyncExternalStore((l) => (soundListeners.add(l), () => soundListeners.delete(l)), effectiveSound, () => false);
}

if (web && typeof document !== "undefined") {
  // Browsers refuse to autoplay with sound until the first tap or key, so a saved "sound on" waits for it.
  const unlock = (e: Event) => {
    if ((e.target as Element | null)?.closest?.('[data-testid="sound-button"]')) return; // the button sets sound itself; unlocking first flips its toggle
    unlocked = true;
    notify();
    document.removeEventListener("pointerdown", unlock, true);
    document.removeEventListener("keydown", unlock, true);
  };
  document.addEventListener("pointerdown", unlock, true);
  document.addEventListener("keydown", unlock, true);
  for (const t of ["contextmenu", "dragstart"]) document.addEventListener(t, (e) => (e.target as Element | null)?.closest?.("img, video") && e.preventDefault());
  const css = document.createElement("style");
  css.textContent = "img, video { -webkit-user-drag: none; -webkit-touch-callout: none; user-select: none; }";
  document.head.appendChild(css);
}

export function useInView(ratio = 0.6) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current as unknown as Element | null;
    if (web && node && typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver(([e]) => setInView(e.intersectionRatio >= ratio), { threshold: [0, ratio, 1] });
      io.observe(node);
      return () => io.disconnect();
    }
    const id = setInterval(() => {
      ref.current?.measureInWindow((_x: number, y: number, _w: number, h: number) => {
        if (!h) return setInView(false);
        const visible = Math.min(y + h, Dimensions.get("window").height) - Math.max(y, 0);
        setInView(visible / h >= ratio);
      });
    }, 350);
    return () => clearInterval(id);
  }, [ratio]);
  return [ref, inView] as const;
}

function LivePlayer({ media, fit, tapToPause, onPlaying }: { media: Media; fit: "cover" | "contain"; tapToPause: boolean; onPlaying: (on: boolean) => void }) {
  const sound = useSound();
  const [started, setStarted] = useState(false);
  const [held, setHeld] = useState(false);
  const player = useVideoPlayer(media.url, (p) => {
    p.loop = true;
    p.muted = !effectiveSound();
    p.play();
  });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  const { status } = useEvent(player, "statusChange", { status: player.status });
  useEffect(() => {
    if (status === "readyToPlay" && !held) player.play();
  }, [player, status, held]);
  useEffect(() => {
    if (isPlaying) setStarted(true);
    onPlaying(isPlaying);
  }, [isPlaying, onPlaying]);
  useEffect(() => {
    player.muted = !sound;
  }, [player, sound]);
  const toggle = () => {
    const was = player.playing;
    if (was) player.pause();
    else player.play();
    setHeld(was);
  };
  return (
    <>
      <VideoView player={player} style={[fill, { opacity: started ? 1 : 0 }]} nativeControls={false} contentFit={fit} />
      {tapToPause && (
        <Pressable accessibilityRole="button" accessibilityLabel={isPlaying ? "Pause" : "Play"} onPress={toggle} style={[full, { alignItems: "center", justifyContent: "center" }]}>
          {started && !isPlaying && (
            <Glass style={{ width: 64, height: 64, borderRadius: 32, paddingLeft: 4 }}>
              <Icon name="play" size={28} color="#fff" />
            </Glass>
          )}
        </Pressable>
      )}
    </>
  );
}

function SoundButton() {
  const sound = useSound();
  return (
    <Pressable testID="sound-button" accessibilityRole="button" accessibilityLabel={sound ? "Turn sound off" : "Turn sound on"} hitSlop={12} onPress={() => setSound(!sound)} style={{ position: "absolute", right: 10, bottom: 10 }}>
      <Glass style={{ width: 30, height: 30, borderRadius: 15 }}>
        <Icon name={sound ? "sound" : "muted"} size={15} color="#fff" strokeWidth={2} />
      </Glass>
    </Pressable>
  );
}

export function InlineVideo({ media, style, fit = "cover", tapToPause = false }: { media: Media; style?: StyleProp<ViewStyle>; fit?: "cover" | "contain"; tapToPause?: boolean }) {
  const [ref, inView] = useInView();
  const [playing, setPlaying] = useState(false);
  const live = inView && !media.url.startsWith("mock:");
  useEffect(() => {
    if (!live) setPlaying(false);
  }, [live]);
  return (
    <View ref={ref} style={[{ overflow: "hidden", backgroundColor: "#140f0b" }, style]}>
      <MediaImage media={media} style={full} fit={fit} playSize={playing || live ? 0 : 56} />
      {live && <LivePlayer media={media} fit={fit} tapToPause={tapToPause} onPlaying={setPlaying} />}
      {live && <SoundButton />}
    </View>
  );
}

export function VideoPreview({ uri, style }: { uri: string; style?: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={[{ backgroundColor: "#000", width: "100%", height: "100%" }, style]} nativeControls={false} contentFit="cover" />;
}

export function MediaFull({ media, style }: { media: Media; style?: StyleProp<ViewStyle> }) {
  if (media.kind === "video") return <InlineVideo media={media} style={style} fit="contain" tapToPause />;
  return <MediaImage media={media} style={style} fit="contain" playSize={60} />;
}
