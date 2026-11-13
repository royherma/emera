import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, Wordmark } from "./ui";
import { colors, space, type } from "@/lib/theme";

export function AuthShell({ title, lead, children, back = true }: { title: string; lead?: string; children: ReactNode; back?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[6], paddingHorizontal: space[4] }} keyboardShouldPersistTaps="handled">
        <View style={{ width: "100%", maxWidth: 440, flex: 1, gap: space[6] }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
            {back ? <IconButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))} /> : <View />}
            <Wordmark size={26} />
            <View style={{ width: 42 }} />
          </View>
          <View style={{ gap: space[2], marginTop: space[4] }}>
            <Text style={[type.h1, { color: colors.ink }]}>{title}</Text>
            {lead ? <Text style={[type.body, { color: colors.muted }]}>{lead}</Text> : null}
          </View>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
