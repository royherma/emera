import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, PressableStateCallbackType, StyleProp, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, SvgXml } from "react-native-svg";
import { Icon, IconName } from "./Icon";
import brand from "@/lib/brand";
import { alpha, elevation, font, radius, size as sizes, space, sun, type } from "@/lib/theme";
import { useTheme } from "@/state/theme";
import { markPath, markTransform } from "@/lib/markPath";
import { markLitTemplate } from "@/lib/markLit";

export type PS = PressableStateCallbackType & { hovered?: boolean };

export const sunGradient = [sun.sunHigh, sun.sun] as const;
const web = Platform.OS === "web";
const shadow = (v: string) => ({ boxShadow: v }) as object;

const markShape = `<path transform="${markTransform}" d="${markPath}"/>`;
let markSeq = 0;

export function Mark({ size = 28 }: { size?: number }) {
  const { c } = useTheme();
  const id = useRef(`em${markSeq++}`).current;
  const xml = useMemo(() => markLitTemplate.replaceAll("__ID__", id).replace("__INK__", c.ink).replace("__MARK__", markShape), [id, c.ink]);
  return <SvgXml xml={xml} width={size} height={size} />;
}

export function Wordmark({ size = 22 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Mark size={size * 1.52} />
      <Text style={{ fontFamily: font.display.semibold, fontSize: size, lineHeight: size * 1.2, color: c.ink, letterSpacing: -size * 0.045 }}>{brand.name}</Text>
    </View>
  );
}

type BtnProps = {
  label: string;
  onPress?: () => void;
  kind?: "primary" | "secondary" | "ghost" | "danger";
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: "sm" | "md" | "lg";
};

const heights = { sm: 36, md: 44, lg: 52 } as const;

export function Button({ label, onPress, kind = "primary", icon, busy, disabled, style, size = "md" }: BtnProps) {
  const { c } = useTheme();
  const fg = kind === "primary" ? c.onSun : kind === "danger" ? c.danger : c.ink;
  const off = disabled || busy;
  const base: ViewStyle = {
    height: heights[size],
    paddingHorizontal: size === "sm" ? space[4] : space[5],
    borderRadius: size === "sm" ? 11 : radius.button,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    overflow: "hidden",
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      onPress={off ? undefined : onPress}
      style={({ pressed, hovered }: PS) => [
        base,
        kind === "primary" && !off && shadow(elevation.sun),
        kind === "secondary" && { backgroundColor: c.sunk },
        kind === "danger" && { backgroundColor: c.sunk },
        hovered && !off && { opacity: 0.9 },
        pressed && !off && { transform: [{ scale: 0.98 }] },
        off && { opacity: 0.45 },
        style,
      ]}
    >
      {kind === "primary" && <LinearGradient colors={sunGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", inset: 0 }} />}
      {busy ? <ActivityIndicator color={fg} /> : icon ? <View><Icon name={icon} size={18} color={fg} /></View> : null}
      <Text style={[type.button, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, tint, filled = true }: { icon: IconName; onPress: () => void; label: string; tint?: string; filled?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ hovered, pressed }: PS) => [
        { width: sizes.tapMin, height: sizes.tapMin, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: filled ? c.sunk : "transparent" },
        hovered && { opacity: 0.8 },
        pressed && { transform: [{ scale: 0.94 }] },
      ]}
    >
      <Icon name={icon} size={20} color={tint ?? c.ink} />
    </Pressable>
  );
}

export function Field({ label, error, hint, style, ...rest }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={[type.label, { color: c.ink2, textTransform: "uppercase", letterSpacing: 0.8 }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.ink3}
        selectionColor={c.sun}
        {...rest}
        onFocus={(e) => {
          setFocus(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          rest.onBlur?.(e);
        }}
        style={[
          { height: 52, borderRadius: radius.field, borderWidth: 1.5, borderColor: error ? c.danger : focus ? c.sun : "transparent", backgroundColor: c.sunk, paddingHorizontal: space[4], fontFamily: font.body.medium, fontSize: 16, color: c.ink },
          style,
          { outlineStyle: "none" } as object,
        ]}
      />
      {error ? <Text style={[type.meta, { color: c.danger }]}>{error}</Text> : hint ? <Text style={[type.meta, { color: c.ink2 }]}>{hint}</Text> : null}
    </View>
  );
}

export function Pulse({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 900, useNativeDriver: true }), Animated.timing(v, { toValue: 0.55, duration: 900, useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, [v]);
  return <Animated.View style={[{ backgroundColor: c.sunk, opacity: v, borderRadius: radius.tile }, style]} />;
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: space[7], paddingHorizontal: space[5], gap: space[3] }}>
      <View style={{ width: 64, height: 64, borderRadius: 99, backgroundColor: alpha(c.sun, 0.16), alignItems: "center", justifyContent: "center", marginBottom: space[1] }}>
        <Icon name={icon} size={28} color={c.sunInk} />
      </View>
      <Text style={[type.h2, { color: c.ink, textAlign: "center" }]}>{title}</Text>
      <Text style={[type.body, { color: c.ink2, textAlign: "center", maxWidth: 340 }]}>{body}</Text>
      {action ? <View style={{ marginTop: space[2] }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <EmptyState icon="sun" title="That didn't load" body={message} action={<Button label="Try again" kind="secondary" onPress={onRetry} />} />;
}

export function Banner({ text, tone = "error" }: { text: string; tone?: "error" | "info" }) {
  const { c } = useTheme();
  const tint = tone === "error" ? c.danger : c.sunInk;
  return (
    <View style={{ backgroundColor: alpha(tone === "error" ? c.danger : c.sun, 0.12), borderRadius: radius.field, paddingVertical: space[3], paddingHorizontal: space[4] }}>
      <Text style={[type.bodySm, { color: tint }]}>{text}</Text>
    </View>
  );
}

export function Chip({ label, color, onPress, active }: { label: string; color?: string; onPress?: () => void; active?: boolean }) {
  const { c } = useTheme();
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 30, paddingHorizontal: 12, paddingLeft: color ? 10 : 12, borderRadius: radius.pill, backgroundColor: active ? c.ink : c.sunk }}>
      {color ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} /> : null}
      <Text style={[type.label, { fontSize: 12.5, letterSpacing: 0, color: active ? c.bg : c.ink2 }]}>{label}</Text>
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress} hitSlop={{ top: 7, bottom: 7 }}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function CategoryTag({ label, color }: { label: string; color: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, ...(web ? ({ boxShadow: `0 0 0 3px ${alpha(color, 0.25)}` } as object) : {}) }} />
      <Text style={[type.label, { color: c.ink2 }]}>{label}</Text>
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; icon?: IconName }[]; onChange: (v: T) => void }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.pill, backgroundColor: c.sunk }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(o.value)} style={{ flex: 1, height: 36, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: on ? c.ink : "transparent" }}>
            {o.icon ? <Icon name={o.icon} size={15} color={on ? c.bg : c.ink2} strokeWidth={2} /> : null}
            <Text style={[type.label, { fontSize: 12.5, letterSpacing: 0, color: on ? c.bg : c.ink2 }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

let blurOk: boolean | null = null;
const canBlur = () => {
  if (!web) return false;
  if (blurOk === null) blurOk = typeof CSS !== "undefined" && !!CSS.supports?.("backdrop-filter", "blur(1px)");
  return blurOk;
};

export function Glass({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const blur = canBlur();
  return (
    <View
      pointerEvents="none"
      style={[
        { backgroundColor: blur ? "rgba(14,10,8,0.42)" : "rgba(14,10,8,0.66)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", flexDirection: "row" },
        blur ? ({ backdropFilter: "blur(10px) saturate(1.5)", WebkitBackdropFilter: "blur(10px) saturate(1.5)" } as object) : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
