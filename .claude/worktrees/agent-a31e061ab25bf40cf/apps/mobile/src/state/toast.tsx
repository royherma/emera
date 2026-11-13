import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { radius, sun, type, size } from "@/lib/theme";
import { useTheme } from "@/state/theme";

const ToastCtx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<string | null>(null);
  const v = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback(
    (m: string) => {
      setMsg(m);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(v, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      timer.current = setTimeout(() => Animated.timing(v, { toValue: 0, duration: 200, useNativeDriver: true }).start(), 2200);
    },
    [v],
  );
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: size.tabBar + insets.bottom + 34, alignItems: "center", opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.ink, paddingHorizontal: 16, height: 40, borderRadius: radius.pill }}>
          <Icon name="check" size={16} color={sun.sun} strokeWidth={2.4} />
          <Text style={[type.name, { color: c.bg }]}>{msg}</Text>
        </View>
      </Animated.View>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
