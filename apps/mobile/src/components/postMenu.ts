import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { copyText, confirmAsk, shareLink } from "@/lib/share";
import { useAuth } from "@/state/auth";
import { useSheet } from "@/state/sheet";
import { useToast } from "@/state/toast";
import type { Post } from "@/lib/types";

export function usePostMenu(onDeleted?: (id: string) => void) {
  const router = useRouter();
  const toast = useToast();
  const sheet = useSheet();
  const { user } = useAuth();

  return (post: Post) => {
    const own = user?.id === post.author.id;
    const actions = [
      { label: "Report a copy", icon: "flag" as const, onPress: () => router.push({ pathname: "/report", params: { id: post.id } }) },
      { label: "Share", icon: "share" as const, onPress: async () => (await shareLink(post.url, `A post by @${post.author.handle}`)) === "copied" && toast("Link copied") },
      { label: "Copy link", icon: "link" as const, onPress: async () => (await copyText(post.url), toast("Link copied")) },
    ];
    if (own) {
      actions.push({
        label: "Delete post",
        icon: "trash" as const,
        destructive: true,
        onPress: () =>
          confirmAsk("Delete this post?", "It will be removed for everyone. This can't be undone.", "Delete", async () => {
            await api.deletePost(post.id);
            onDeleted?.(post.id);
          }),
      } as (typeof actions)[number] & { destructive: boolean });
    }
    sheet(actions);
  };
}
