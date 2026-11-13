import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { Banner, Button, EmptyState, ErrorState, Pulse } from "@/components/ui";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { confirmAsk } from "@/lib/share";
import { alpha, font, radius, space, type } from "@/lib/theme";
import { ApiError, type Comment } from "@/lib/types";
import { useAuth } from "@/state/auth";
import { useResource } from "@/state/resource";
import { useTheme } from "@/state/theme";
import { RoleBadge } from "@/components/RoleBadge";

const MAX = 500;

type Thread = { comments: Comment[]; cursor: string | null; total: number };

function Item({ comment, small, canDelete, onReply, onDelete }: { comment: Comment; small?: boolean; canDelete: boolean; onReply?: () => void; onDelete: () => void }) {
  const { c } = useTheme();
  const router = useRouter();
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <Pressable accessibilityRole="link" accessibilityLabel={`${comment.author.displayName}'s profile`} onPress={() => router.push({ pathname: "/u/[handle]", params: { handle: comment.author.handle } })}>
        <Avatar user={comment.author} size={small ? 28 : 36} />
      </Pressable>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[type.meta, { color: c.ink3 }]}>
          <Text style={[type.name, { color: c.ink }]}>{comment.author.displayName}</Text>{comment.author.role ? <>{" "}<RoleBadge role={comment.author.role} /></> : null} @{comment.author.handle} · {timeAgo(comment.createdAt)}
        </Text>
        <Text style={[type.bodySm, { color: c.ink }]}>{comment.body}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 28 }}>
          {onReply && (
            <Pressable accessibilityRole="button" accessibilityLabel={`Reply to ${comment.author.displayName}`} onPress={onReply} hitSlop={8}>
              <Text style={[type.label, { color: c.ink2 }]}>Reply</Text>
            </Pressable>
          )}
          {canDelete && (
            <Pressable accessibilityRole="button" accessibilityLabel="Delete comment" onPress={onDelete} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="trash" size={14} color={c.ink3} />
              <Text style={[type.label, { color: c.ink3 }]}>Delete</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export function Thread({ postId: id, onCount, inline = false }: { postId: string; onCount?: (n: number) => void; inline?: boolean }) {
  const { c } = useTheme();
  const { user } = useAuth();
  const post = useResource(() => api.post(id), `post:${id}`);
  const list = useResource<Thread>(() => api.comments(id), `comments:${id}`);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);

  const data = list.data;
  const postAuthor = post.data?.author.id;
  useEffect(() => {
    if (data) onCount?.(data.total);
  }, [data?.total]);
  const canDelete = (cm: Comment) => !!user && (cm.author.id === user.id || postAuthor === user.id);

  const send = async () => {
    const body = text.trim();
    if (!body || busy || !data) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.addComment({ postId: id, body, parentId: replyTo?.id });
      if (replyTo) {
        list.setData({ ...data, total: data.total + 1, comments: data.comments.map((t) => (t.id === replyTo.id ? { ...t, replies: [...t.replies, created] } : t)) });
      } else {
        list.setData({ ...data, total: data.total + 1, comments: [...data.comments, created] });
      }
      setText("");
      setReplyTo(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't post. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = (cm: Comment) =>
    confirmAsk("Delete this comment?", "It will be removed for everyone.", "Delete", async () => {
      if (!data) return;
      try {
        await api.deleteComment(cm.id);
        const gone = 1 + cm.replies.length;
        const next = cm.parentId
          ? data.comments.map((t) => (t.id === cm.parentId ? { ...t, replies: t.replies.filter((r) => r.id !== cm.id) } : t))
          : data.comments.filter((t) => t.id !== cm.id);
        list.setData({ ...data, total: Math.max(0, data.total - gone), comments: next });
        if (replyTo?.id === cm.id) setReplyTo(null);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "That didn't go through. Try again.");
      }
    });

  const loadMore = async () => {
    if (!data?.cursor) return;
    setMore(true);
    try {
      const next = await api.comments(id, data.cursor);
      const seen = new Set(data.comments.map((x) => x.id));
      list.setData({ comments: [...data.comments, ...next.comments.filter((x) => !seen.has(x.id))], cursor: next.cursor, total: next.total });
    } finally {
      setMore(false);
    }
  };

  return (
    <View>
      <View style={{ gap: space[2], marginBottom: space[4] }}>
        {replyTo && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", backgroundColor: alpha(c.sun, 0.14), borderRadius: radius.pill, paddingLeft: 12, paddingRight: 4, height: 32 }}>
            <Text style={[type.label, { color: c.sunInk }]}>Replying to @{replyTo.author.handle}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel reply" onPress={() => setReplyTo(null)} hitSlop={8} style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>
              <Icon name="x" size={14} color={c.sunInk} />
            </Pressable>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={replyTo ? "Write a reply" : "Add a comment"}
            placeholderTextColor={c.ink3}
            selectionColor={c.sun}
            maxLength={MAX}
            accessibilityLabel="Comment"
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            onSubmitEditing={send}
            returnKeyType="send"
            style={[{ flex: 1, height: 48, borderRadius: radius.field, borderWidth: 1.5, borderColor: focus ? c.sun : "transparent", backgroundColor: c.sunk, paddingHorizontal: space[4], fontFamily: font.body.medium, fontSize: 16, color: c.ink }, { outlineStyle: "none" } as object]}
          />
          <Button label="Post" icon="send" busy={busy} disabled={!text.trim() || !data} onPress={send} />
        </View>
        {error ? <Banner text={error} /> : null}
      </View>

      {list.error && !data ? (
        <ErrorState message={list.error} onRetry={list.retry} />
      ) : list.loading || !data ? (
        <View style={{ gap: space[4] }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10 }}>
              <Pulse style={{ width: 36, height: 36, borderRadius: 18 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Pulse style={{ width: 140, height: 12, borderRadius: 6 }} />
                <Pulse style={{ height: 12, borderRadius: 6 }} />
              </View>
            </View>
          ))}
        </View>
      ) : data.comments.length === 0 ? (
        inline ? null : <EmptyState icon="chat" title="Start the conversation" body="Tell the maker what you noticed. Be kind and be specific." />
      ) : (
        <View style={{ gap: space[5] }}>
          {data.comments.map((t) => (
            <View key={t.id} style={{ gap: space[3] }}>
              <Item comment={t} canDelete={canDelete(t)} onReply={() => setReplyTo(t)} onDelete={() => remove(t)} />
              {t.replies.length > 0 && (
                <View style={{ marginLeft: 46, gap: space[3], borderLeftWidth: 2, borderLeftColor: c.hair, paddingLeft: space[3] }}>
                  {t.replies.map((r) => (
                    <Item key={r.id} comment={r} small canDelete={canDelete(r)} onDelete={() => remove(r)} />
                  ))}
                </View>
              )}
            </View>
          ))}
          {data.cursor && (
            <View style={{ alignItems: "center" }}>
              <Button label="Show more" kind="secondary" busy={more} onPress={loadMore} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}
