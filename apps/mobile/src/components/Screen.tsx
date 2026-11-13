import { ComponentRef, ReactNode, Ref, useCallback, useEffect, useRef } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Platform, RefreshControl, ScrollView, StyleProp, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLayout } from "@/lib/layout";
import { size } from "@/lib/theme";
import { useTheme } from "@/state/theme";
import { SnapProvider, pageByWheel, snapContainer, useSnapHost } from "./Snap";

export function Screen({ children, onRefresh, refreshing, tabs = false, maxWidth, style, flush = false, scrollRef, onScroll, snap = false }: { children: ReactNode; snap?: boolean; scrollRef?: Ref<ComponentRef<typeof ScrollView>>; onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void; onRefresh?: () => void; refreshing?: boolean; tabs?: boolean; maxWidth?: number; style?: StyleProp<ViewStyle>; flush?: boolean }) {
  const { wide, pad, content } = useLayout();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const paddingTop = wide ? 24 : insets.top + 6;
  const { inner, offsets, host } = useSnapHost(paddingTop);
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
    const el = snap && Platform.OS === "web" ? (own.current as unknown as { getScrollableNode?: () => HTMLElement } | null)?.getScrollableNode?.() : null;
    return el ? pageByWheel(el) : undefined;
  }, [snap]);
  const body = (
    <View ref={inner} style={[{ width: "100%", maxWidth: maxWidth ?? content, paddingHorizontal: flush ? 0 : pad }, style]}>
      {children}
    </View>
  );
  return (
    <ScrollView
      ref={setRef}
      onScroll={onScroll}
      scrollEventThrottle={onScroll ? 100 : undefined}
      style={[{ flex: 1, backgroundColor: c.bg }, snap ? snapContainer : null]}
      snapToOffsets={snap && offsets.length ? offsets : undefined}
      decelerationRate={snap ? "fast" : undefined}
      contentContainerStyle={{ paddingTop, paddingBottom: (tabs && !wide ? size.tabBar + 44 : 40) + insets.bottom, alignItems: "center" }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.sun} /> : undefined}
    >
      {snap ? <SnapProvider value={host}>{body}</SnapProvider> : body}
    </ScrollView>
  );
}
