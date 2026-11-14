import { ComponentRef, ReactNode, Ref } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, RefreshControl, ScrollView, StyleProp, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLayout } from "@/lib/layout";
import { size } from "@/lib/theme";
import { useTheme } from "@/state/theme";

export function Screen({ children, onRefresh, refreshing, tabs = false, maxWidth, style, flush = false, scrollRef, onScroll }: { children: ReactNode; scrollRef?: Ref<ComponentRef<typeof ScrollView>>; onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void; onRefresh?: () => void; refreshing?: boolean; tabs?: boolean; maxWidth?: number; style?: StyleProp<ViewStyle>; flush?: boolean }) {
  const { wide, pad, content } = useLayout();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const paddingTop = wide ? 24 : insets.top + 6;
  return (
    <ScrollView
      ref={scrollRef}
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
