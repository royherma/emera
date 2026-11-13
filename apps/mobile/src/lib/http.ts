import { API_URL } from "./config";
import { ApiError, Backend, Comment, Media, Notification, PickedFile, Post, User, UserPage } from "./types";

let token: string | null = null;
export const setToken = (t: string | null) => {
  token = t;
};

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("network", "Can't reach the server. Check your connection and try again.");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(json?.error?.code ?? `http_${res.status}`, json?.error?.message ?? "Something went wrong. Try again.");
  }
  return json as T;
}

const pageQuery = (cursor?: string | null) => (cursor ? `?cursor=${encodeURIComponent(cursor)}` : "");
const userPage = (r: { users: User[]; cursor?: string | null }): UserPage => ({ users: r.users, cursor: r.cursor ?? null });

export const http: Backend = {
  authStart: async (email, invite) => void (await send("POST", "/v1/auth/start", { email, invite })),
  authVerify: (email, code) => send("POST", "/v1/auth/verify", { email, code }),
  setHandle: async (input) => (await send<{ user: User }>("POST", "/v1/auth/handle", input)).user,
  me: async () => (await send<{ user: User }>("GET", "/v1/me")).user,
  logout: async () => void (await send("POST", "/v1/auth/logout")),
  feed: async (cursor, mode) => {
    const q = new URLSearchParams();
    if (cursor) q.set("cursor", cursor);
    if (mode === "following") q.set("mode", "following");
    const qs = q.toString();
    const r = await send<{ posts: Post[]; cursor?: string | null }>("GET", `/v1/feed${qs ? `?${qs}` : ""}`);
    return { posts: r.posts, cursor: r.cursor ?? null };
  },
  post: async (id) => (await send<{ post: Post }>("GET", `/v1/posts/${encodeURIComponent(id)}`)).post,
  deletePost: async (id) => void (await send("DELETE", `/v1/posts/${encodeURIComponent(id)}`)),
  profile: async (handle, cursor) => {
    const r = await send<{ user: User; posts: Post[]; cursor?: string | null }>("GET", `/v1/users/${encodeURIComponent(handle)}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    return { user: r.user, posts: r.posts, cursor: r.cursor ?? null };
  },
  uploadMedia: async (file: PickedFile, onProgress?: (share: number) => void): Promise<Media> => {
    const blob = await (await fetch(file.uri)).blob();
    const slot = await send<{ uploadId: string; uploadUrl: string; partSize?: number; partCount?: number }>("POST", "/v1/uploads", { contentType: file.mimeType, bytes: blob.size, seconds: file.seconds });
    const target = slot.uploadUrl.startsWith("http") ? slot.uploadUrl : API_URL + slot.uploadUrl;
    const auth: Record<string, string> = target.startsWith(API_URL) && token ? { Authorization: `Bearer ${token}` } : {};
    const call = async (method: string, url: string, body: Blob | string, contentType: string) => {
      let res: Response;
      try {
        res = await fetch(url, { method, headers: { "Content-Type": contentType, ...auth }, body });
      } catch {
        throw new ApiError("network", "The upload didn't go through. Check your connection and try again.");
      }
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(json?.error?.code ?? `http_${res.status}`, json?.error?.message ?? "The upload failed. Try again.");
      return json;
    };
    if (!slot.partSize || !slot.partCount) return (await call("PUT", target, blob, file.mimeType)).media as Media;

    const parts: Array<{ partNumber: number; etag: string }> = [];
    for (let n = 1; n <= slot.partCount; n++) {
      const chunk = blob.slice((n - 1) * slot.partSize, n * slot.partSize);
      for (let tries = 1; ; tries++) {
        try {
          parts.push(await call("PUT", `${target}/parts/${n}`, chunk, file.mimeType));
          break;
        } catch (e) {
          if (tries === 3 || !(e instanceof ApiError && (e.code === "network" || e.code.startsWith("http_5")))) throw e;
        }
      }
      onProgress?.(n / slot.partCount);
    }
    return (await call("POST", `${target}/complete`, JSON.stringify({ parts }), "application/json")).media as Media;
  },
  createPost: async (input) => (await send<{ post: Post }>("POST", "/v1/posts", input)).post,
  listInvites: () => send("GET", "/v1/invites"),
  createInvite: (maxUses) => send("POST", "/v1/invites", maxUses ? { maxUses } : {}),
  report: async (input) => void (await send("POST", "/v1/reports", input)),
  follow: async (handle) => (await send<{ user: User }>("POST", `/v1/follows/${encodeURIComponent(handle)}`)).user,
  unfollow: async (handle) => (await send<{ user: User }>("DELETE", `/v1/follows/${encodeURIComponent(handle)}`)).user,
  followers: async (handle, cursor) => userPage(await send("GET", `/v1/users/${encodeURIComponent(handle)}/followers${pageQuery(cursor)}`)),
  following: async (handle, cursor) => userPage(await send("GET", `/v1/users/${encodeURIComponent(handle)}/following${pageQuery(cursor)}`)),
  block: async (handle) => (await send<{ user: User }>("POST", `/v1/blocks/${encodeURIComponent(handle)}`)).user,
  unblock: async (handle) => (await send<{ user: User }>("DELETE", `/v1/blocks/${encodeURIComponent(handle)}`)).user,
  mute: async (handle) => (await send<{ user: User }>("POST", `/v1/mutes/${encodeURIComponent(handle)}`)).user,
  unmute: async (handle) => (await send<{ user: User }>("DELETE", `/v1/mutes/${encodeURIComponent(handle)}`)).user,
  blocks: async (cursor) => userPage(await send("GET", `/v1/me/blocks${pageQuery(cursor)}`)),
  mutes: async (cursor) => userPage(await send("GET", `/v1/me/mutes${pageQuery(cursor)}`)),
  like: (postId) => send("POST", `/v1/posts/${encodeURIComponent(postId)}/like`),
  unlike: (postId) => send("DELETE", `/v1/posts/${encodeURIComponent(postId)}/like`),
  comments: async (postId, cursor) => {
    const r = await send<{ comments: Comment[]; cursor?: string | null; total: number }>("GET", `/v1/posts/${encodeURIComponent(postId)}/comments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    return { comments: r.comments, cursor: r.cursor ?? null, total: r.total };
  },
  addComment: async ({ postId, body, parentId }) => (await send<{ comment: Comment }>("POST", `/v1/posts/${encodeURIComponent(postId)}/comments`, { body, parentId })).comment,
  deleteComment: async (id) => void (await send("DELETE", `/v1/comments/${encodeURIComponent(id)}`)),
  notifications: async (cursor) => {
    const r = await send<{ notifications: Notification[]; cursor?: string | null; unread: number }>("GET", `/v1/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    return { notifications: r.notifications, cursor: r.cursor ?? null, unread: r.unread };
  },
  unreadCount: async () => (await send<{ unread: number }>("GET", "/v1/notifications/unread-count")).unread,
  markNotificationsRead: async (ids) => (await send<{ unread: number }>("POST", "/v1/notifications/read", ids ? { ids } : {})).unread,
  search: async (q, kind, cursor) => {
    const r = await send<{ users?: User[]; posts?: Post[]; cursor?: string | null }>("GET", `/v1/search?q=${encodeURIComponent(q)}&type=${kind}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    return { users: r.users ?? [], posts: r.posts ?? [], cursor: r.cursor ?? null };
  },
  updateProfile: async (input) => (await send<{ user: User }>("PATCH", "/v1/me", input)).user,
  flag: async (input) => void (await send("POST", "/v1/flags", input)),
};
