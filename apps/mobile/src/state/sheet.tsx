import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, IconName } from "@/components/Icon";
import { elevation, motion, radius, space, type } from "@/lib/theme";
import { useLayout } from "@/lib/layout";
import { useTheme } from "@/state/theme";

export type SheetAction = { label: string; icon: IconName; onPress: () => void; destructive?: boolean };

const SheetCtx = createContext<(actions: SheetAction[]) => void>(() => {});

export function SheetProvider({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const { wide } = useLayout();
  const insets = useSafeAreaInsets();
  const [actions, setActions] = useState<SheetAction[] | null>(null);
  const v = useRef(new Animated.Value(0)).current;

  const open = useCallback(
    (a: SheetAction[]) => {
      setActions(a);
      Animated.timing(v, { toValue: 1, duration: motion.sheet, easing: Easing.out(Easing.exp), useNativeDriver: true }).start();
    },
    [v],
  );
  const close = useCallback(
    (then?: () => void) => {
      Animated.timing(v, { toValue: 0, duration: motion.fast, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
        setActions(null);
        then?.();
      });
    },
    [v],
  );

  useEffect(() => {
    if (Platform.OS !== "web" || !actions) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, close]);

  return (
    <SheetCtx.Provider value={open}>
      {children}
      {actions && (
        <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: wide ? "center" : "flex-end", alignItems: "center", zIndex: 50 }} accessibilityViewIsModal>
          <Animated.View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(14,10,8,0.55)", opacity: v }}>
            <Pressable accessibilityLabel="Close" style={{ flex: 1 }} onPress={() => close()} />
          </Animated.View>
          <Animated.View
            style={[
              { width: "100%", maxWidth: 440, backgroundColor: c.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space[2], paddingHorizontal: space[3], paddingBottom: Math.max(insets.bottom, space[3]) + space[2], opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] },
              wide && { borderRadius: radius.sheet },
              Platform.OS === "web" ? ({ boxShadow: elevation.sheet } as object) : null,
            ]}
          >
            <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: c.hair, marginBottom: space[2] }} />
            {actions.map((a) => (
              <Pressable
                key={a.label}
                accessibilityRole="button"
                onPress={() => close(a.onPress)}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({ height: 52, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[3], borderRadius: radius.field, backgroundColor: pressed || hovered ? c.sunk : "transparent" })}
              >
                <Icon name={a.icon} size={20} color={a.destructive ? c.danger : c.ink} />
                <Text style={[type.body, { fontFamily: type.name.fontFamily, color: a.destructive ? c.danger : c.ink }]}>{a.label}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={() => close()} style={{ height: 48, marginTop: space[2], borderRadius: radius.field, backgroundColor: c.sunk, alignItems: "center", justifyContent: "center" }}>
              <Text style={[type.button, { color: c.ink }]}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}
    </SheetCtx.Provider>
  );
}

export const useSheet = () => useContext(SheetCtx);
