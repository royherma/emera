import { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleProp, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/lib/theme";
import { useLayout } from "@/lib/layout";

export function Screen({ children, onRefresh, refreshing, tabs = false, maxWidth, style, flush = false }: { children: ReactNode; onRefresh?: () => void; refreshing?: boolean; tabs?: boolean; maxWidth?: number; style?: StyleProp<ViewStyle>; flush?: boolean }) {
  const { wide, pad, content } = useLayout();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: wide ? 24 : insets.top + 8, paddingBottom: (tabs && !wide ? 110 : 40) + insets.bottom, alignItems: "center" }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}
    >
      <View style={[{ width: "100%", maxWidth: maxWidth ?? content, paddingHorizontal: flush ? 0 : pad }, style]}>{children}</View>
    </ScrollView>
  );
}
