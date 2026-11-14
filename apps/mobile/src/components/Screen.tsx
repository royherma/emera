import { ComponentRef, ReactNode, Ref, useCallback, useEffect, useRef } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Platform, RefreshControl, ScrollView, StyleProp, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLayout } from "@/lib/layout";
import { settleOnStop } from "@/lib/settle";
import { size } from "@/lib/theme";
import { useTheme } from "@/state/theme";

export function Screen({ children, onRefresh, refreshing, tabs = false, maxWidth, style, flush = false, scrollRef, onScroll, settle = false }: { children: ReactNode; settle?: boolean; scrollRef?: Ref<ComponentRef<typeof ScrollView>>; onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void; onRefresh?: () => void; refreshing?: boolean; tabs?: boolean; maxWidth?: number; style?: StyleProp<ViewStyle>; flush?: boolean }) {
  const { wide, pad, content } = useLayout();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const paddingTop = wide ? 24 : insets.top + 6;
  const own = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const setRef = useCallback(
    (node: ComponentRef<typeof ScrollView> | null) => {
      own.current = node;
      if (typeof scrollRef === "function") scrollRef(node);
      else if (scrollRef) (scrollRef as { current: unknown }).current = node;
    },
    [scrollRef],
  );
  useEffect(() => {
    const el = settle && Platform.OS === "web" ? (own.current as unknown as { getScrollableNode?: () => HTMLElement } | null)?.getScrollableNode?.() : null;
    return el ? settleOnStop(el) : undefined;
  }, [settle]);
  return (
    <ScrollView
      ref={setRef}
      onScroll={onScroll}
      scrollEventThrottle={onScroll ? 100 : undefined}
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop, paddingBottom: (tabs && !wide ? size.tabBar + 44 : 40) + insets.bottom, alignItems: "center" }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.sun} /> : undefined}
    >
      <View style={[{ width: "100%", maxWidth: maxWidth ?? content, paddingHorizontal: flush ? 0 : pad }, style]}>
        {children}
      </View>
    </ScrollView>
  );
}
