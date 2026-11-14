import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Icon } from "./Icon";
import { useInView } from "./Media";
import { Button } from "./ui";
import { alpha, space, type } from "@/lib/theme";
import { useTheme } from "@/state/theme";

export function FeedEnd({
  cursor,
  loading,
  failed,
  onMore,
  onRefresh,
}: {
  cursor?: string | null;
  loading: boolean;
  failed: boolean;
  onMore: () => void;
  onRefresh: () => void;
}) {
  const { c } = useTheme();
  const [ref, inView] = useInView(0.01);
  useEffect(() => {
    if (inView && cursor && !failed) onMore();
  }, [inView, cursor, failed, onMore]);
  return (
    <View
      ref={ref}
      testID="feed-end"
      style={{
        minHeight: 180,
        alignItems: "center",
        justifyContent: "center",
        gap: space[3],
        paddingVertical: space[6],
      }}
    >
      {failed ? (
        <>
          <Text style={[type.bodySm, { color: c.ink2 }]}>
            More posts didn't load
          </Text>
          <Button label="Try again" kind="secondary" onPress={onMore} />
        </>
      ) : cursor || loading ? (
        <>
          <ActivityIndicator color={c.sun} />
          <Text style={[type.meta, { color: c.ink3 }]}>Loading more</Text>
        </>
      ) : (
        <>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 99,
              backgroundColor: alpha(c.sun, 0.16),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="check" size={22} color={c.sunInk} strokeWidth={2} />
          </View>
          <Text style={[type.name, { color: c.ink }]}>
            You're all caught up
          </Text>
          <Text style={[type.meta, { color: c.ink3 }]}>
            New posts land at the top
          </Text>
          <Button
            label="Check for new posts"
            kind="secondary"
            onPress={onRefresh}
          />
        </>
      )}
    </View>
  );
}
