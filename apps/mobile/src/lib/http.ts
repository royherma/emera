import { API_URL } from "./config";
import { ApiError, Backend, Media, PickedFile, Post, User } from "./types";

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

export const http: Backend = {
  authStart: async (email, invite) => void (await send("POST", "/v1/auth/start", { email, invite })),
  authVerify: (email, code) => send("POST", "/v1/auth/verify", { email, code }),
  setHandle: async (input) => (await send<{ user: User }>("POST", "/v1/auth/handle", input)).user,
  me: async () => (await send<{ user: User }>("GET", "/v1/me")).user,
  logout: async () => void (await send("POST", "/v1/auth/logout")),
  feed: async (cursor) => {
    const r = await send<{ posts: Post[]; cursor?: string | null }>("GET", `/v1/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    return { posts: r.posts, cursor: r.cursor ?? null };
  },
  post: async (id) => (await send<{ post: Post }>("GET", `/v1/posts/${encodeURIComponent(id)}`)).post,
  deletePost: async (id) => void (await send("DELETE", `/v1/posts/${encodeURIComponent(id)}`)),
  profile: async (handle, cursor) => {
    const r = await send<{ user: User; posts: Post[]; cursor?: string | null }>("GET", `/v1/users/${encodeURIComponent(handle)}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    return { user: r.user, posts: r.posts, cursor: r.cursor ?? null };
  },
  uploadMedia: async (file: PickedFile): Promise<Media> => {
    const blob = await (await fetch(file.uri)).blob();
    const { uploadUrl } = await send<{ uploadId: string; uploadUrl: string }>("POST", "/v1/uploads", { contentType: file.mimeType, bytes: blob.size });
    const target = uploadUrl.startsWith("http") ? uploadUrl : API_URL + uploadUrl;
    const sameOrigin = target.startsWith(API_URL);
    let res: Response;
    try {
      res = await fetch(target, {
        method: "PUT",
        headers: { "Content-Type": file.mimeType, ...(sameOrigin && token ? { Authorization: `Bearer ${token}` } : {}) },
        body: blob,
      });
    } catch {
      throw new ApiError("network", "The upload didn't go through. Check your connection and try again.");
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(json?.error?.code ?? `http_${res.status}`, json?.error?.message ?? "The upload failed. Try again.");
    return json.media as Media;
  },
  createPost: async (input) => (await send<{ post: Post }>("POST", "/v1/posts", input)).post,
  listInvites: () => send("GET", "/v1/invites"),
  createInvite: (maxUses) => send("POST", "/v1/invites", maxUses ? { maxUses } : {}),
  report: async (input) => void (await send("POST", "/v1/reports", input)),
};
