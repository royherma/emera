import { ReactNode, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, PressableStateCallbackType, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { colors, font, radius, space, type } from "@/lib/theme";
import brand from "@/lib/brand";
import { Icon, IconName } from "./Icon";

export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: size * 0.28 }}>
      <View style={{ width: size * 0.62, height: size * 0.62, borderRadius: 99, backgroundColor: colors.accent }} />
      <Text style={{ fontFamily: font.display, fontSize: size, lineHeight: size * 1.1, color: colors.ink, letterSpacing: -0.3 }}>{brand.name}</Text>
    </View>
  );
}

export type PS = PressableStateCallbackType & { hovered?: boolean };

type BtnProps = {
  label: string;
  onPress?: () => void;
  kind?: "primary" | "secondary" | "ghost" | "danger";
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: "md" | "lg";
};

export function Button({ label, onPress, kind = "primary", icon, busy, disabled, style, size = "md" }: BtnProps) {
  const fg = kind === "primary" ? colors.onInk : kind === "danger" ? colors.danger : colors.ink;
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={off ? undefined : onPress}
      style={({ pressed, hovered }: PS) => [
        s.btn,
        size === "lg" && { height: 56, paddingHorizontal: space[6] },
        kind === "primary" && { backgroundColor: colors.ink },
        kind === "secondary" && { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
        kind === "danger" && { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
        hovered && !off && { opacity: 0.88 },
        pressed && !off && { transform: [{ scale: 0.98 }] },
        off && { opacity: 0.45 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={{ fontFamily: font.semibold, fontSize: size === "lg" ? 17 : 15, color: fg }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, tint = colors.ink, bg = colors.surface }: { icon: IconName; onPress: () => void; label: string; tint?: string; bg?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ hovered, pressed }: PS) => [s.iconBtn, { backgroundColor: bg }, hovered && { opacity: 0.8 }, pressed && { transform: [{ scale: 0.94 }] }]}
    >
      <Icon name={icon} size={20} color={tint} />
    </Pressable>
  );
}

export function Field({ label, error, hint, style, ...rest }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={[type.label, { color: colors.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.faint}
        {...rest}
        onFocus={(e) => {
          setFocus(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          rest.onBlur?.(e);
        }}
        style={[s.input, focus && { borderColor: colors.ink }, !!error && { borderColor: colors.danger }, style, { outlineStyle: "none" } as object]}
      />
      {error ? <Text style={[type.small, { color: colors.danger }]}>{error}</Text> : hint ? <Text style={[type.small, { color: colors.muted }]}>{hint}</Text> : null}
    </View>
  );
}

export function Pulse({ style }: { style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 900, useNativeDriver: true }), Animated.timing(v, { toValue: 0.5, duration: 900, useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, [v]);
  return <Animated.View style={[{ backgroundColor: colors.sunk, opacity: v, borderRadius: radius.md }, style]} />;
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: space[7], paddingHorizontal: space[5], gap: space[3] }}>
      <View style={{ width: 72, height: 72, borderRadius: 99, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={30} color={colors.accent} />
      </View>
      <Text style={[type.h2, { color: colors.ink, textAlign: "center" }]}>{title}</Text>
      <Text style={[type.body, { color: colors.muted, textAlign: "center", maxWidth: 360 }]}>{body}</Text>
      {action ? <View style={{ marginTop: space[2] }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <EmptyState icon="sun" title="That didn't load" body={message} action={<Button label="Try again" kind="secondary" onPress={onRetry} />} />;
}

export function Banner({ text, tone = "error" }: { text: string; tone?: "error" | "info" }) {
  return (
    <View style={{ backgroundColor: tone === "error" ? "rgba(179,38,30,0.09)" : colors.accent2Soft, borderRadius: radius.sm, padding: space[3] }}>
      <Text style={[type.small, { color: tone === "error" ? colors.danger : colors.accent2 }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  btn: { height: 48, paddingHorizontal: space[5], borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2] },
  iconBtn: { width: 42, height: 42, borderRadius: 99, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  input: { height: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: space[4], fontFamily: font.regular, fontSize: 16, color: colors.ink },
});
