import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { colors, font, radius } from "@/lib/theme";
import { Icon } from "@/components/Icon";

const ToastCtx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
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
      <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 104, alignItems: "center", opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.ink, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.pill }}>
          <Icon name="check" size={16} color={colors.onInk} />
          <Text style={{ color: colors.onInk, fontFamily: font.medium, fontSize: 14 }}>{msg}</Text>
        </View>
      </Animated.View>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
