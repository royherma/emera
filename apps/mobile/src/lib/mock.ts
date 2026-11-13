import brand from "./brand";
import { PUBLIC_ORIGIN } from "./config";
import { ApiError, Backend, Comment, FeedMode, Invite, Media, Notification, PickedFile, Post, User, UserPage } from "./types";
import { HANDLE_RE } from "./format";
import { makeMockChat } from "./mockChat";

const wait = (ms = 280) => new Promise((r) => setTimeout(r, ms + Math.random() * 220));
const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60000).toISOString();
const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");

const invitesRequired = process.env.EXPO_PUBLIC_MOCK_INVITES === "1";
export const MOCK_INVITE_CODE = "DAYLIGHT";

const people: [string, string, string, string][] = [
  ["mina", "Mina Okafor", "Street and light photographer. Lagos, then Lisbon. Chasing the hour after sunrise.", "Photography"],
  ["jonas_w", "Jonas Weber", "Ceramics, glazes and kiln notes. Everything here is thrown by hand.", "Ceramics"],
  ["tamsin", "Tamsin Reyes", "Illustrator. Quiet scenes, loud colour.", "Illustration"],
  ["koji", "Koji Arai", "Short films and the stills between them.", "Film"],
  ["ila_makes", "Ila Fernandes", "Textiles, natural dyes, slow making.", "Textiles"],
  ["odd_type", "Odd Type Studio", "Typefaces drawn one letter at a time.", "Type design"],
  ["noor", "Noor Haddad", "3D worlds built from paper and light.", "3D"],
  ["bram", "Bram De Smet", "Furniture from fallen trees.", "Woodwork"],
];

const users = new Map<string, User>();
people.forEach(([handle, displayName, bio, category], i) => {
  users.set(handle, { id: `u_${i + 1}`, handle, displayName, bio, avatarUrl: null, createdAt: iso(60 * 24 * (40 + i)), category });
});

type Seed = [string, string, number, number, number, ("image" | "video")?];
const seeds: Seed[] = [
  ["mina", "First light on the Tagus. Shot at 6:12, no edits besides crop.", 4, 5, 8],
  ["jonas_w", "Tenmoku test tiles, cone 10. The iron really came through this time.", 1, 1, 55],
  ["tamsin", "Window seat, late afternoon. Gouache on cotton paper.", 3, 4, 140],
  ["koji", "Frame from the harbour film. 16mm, expired stock.", 16, 9, 260, "video"],
  ["noor", "Paper canyon, lit from the left. Three days of cutting.", 4, 5, 380],
  ["ila_makes", "Madder root, indigo and a lot of patience.", 1, 1, 520],
  ["odd_type", "Lowercase g, version nine. The ear finally sits right.", 4, 3, 700],
  ["bram", "Walnut stool, oiled this morning. Joined without a single screw.", 3, 4, 910],
  ["mina", "Market stairs, golden hour.", 4, 5, 1200],
  ["tamsin", "Sketchbook spread, fresh out of the studio.", 4, 3, 1500],
  ["koji", "Behind the scenes: the rooftop scene.", 1, 1, 1800, "video"],
  ["jonas_w", "Salt-fired bowls, drying.", 4, 5, 2200],
  ["noor", "Morning render test. Soft shadows are finally working.", 3, 4, 2800],
  ["ila_makes", "Woven sample for the autumn series.", 4, 5, 3300],
  ["bram", "The tree it came from, a year ago.", 4, 3, 4100],
  ["odd_type", "Specimen sheet, first proof.", 3, 4, 5000],
  ["mina", "Blue hour from the ferry.", 1, 1, 6100],
  ["tamsin", "Cover study for a children's book.", 4, 5, 7200],
];

let mediaCounter = 0;
const proofFor = (signer: string, signedAt: string) => ({ sha256: hex(64), signedAt, signer });
function makeMedia(signer: string, w: number, h: number, kind: "image" | "video", url: string, signedAt: string, contentType?: string): Media {
  const proof = proofFor(signer, signedAt);
  return {
    id: `m_${++mediaCounter}`,
    kind,
    contentType: contentType ?? (kind === "video" ? "video/mp4" : "image/jpeg"),
    width: w,
    height: h,
    url,
    sha256: proof.sha256,
    proof,
  };
}

const posts: Post[] = seeds.map(([handle, caption, w, h, ago, kind], i) => {
  const author = users.get(handle)!;
  const createdAt = iso(ago);
  const id = `p_${100 + i}`;
  return {
    id,
    author,
    caption,
    createdAt,
    url: `${PUBLIC_ORIGIN}/p/${id}`,
    likeCount: 0,
    commentCount: 0,
    viewer: { liked: false },
    media: [makeMedia(handle, w * 400, h * 400, kind ?? "image", `mock:art/${id}`, createdAt)],
  };
});
posts[0].media.push(makeMedia("mina", 1600, 2000, "image", "mock:art/p_100b", posts[0].createdAt));
posts[0].media.push(makeMedia("mina", 1600, 2000, "image", "mock:art/p_100c", posts[0].createdAt));

const sessions = new Map<string, string>();
const emails = new Map<string, string>();
const invites = new Map<string, string>([[MOCK_INVITE_CODE, "mina"]]);
const MOCK_INVITE_LIMIT = 20;
const mockInvites: Invite[] = [
  { code: "k3m9x2qa", url: `${PUBLIC_ORIGIN}/invite/k3m9x2qa`, uses: 2, maxUses: 5, createdAt: iso(60 * 24 * 6), joined: [{ handle: "wren_clay", displayName: "Wren Alder" }, { handle: "ottoline", displayName: "Ottoline Park" }] },
  { code: "b7w4n8dz", url: `${PUBLIC_ORIGIN}/invite/b7w4n8dz`, uses: 1, maxUses: 1, createdAt: iso(60 * 24 * 11), joined: [{ handle: "sefa_prints", displayName: "Sefa Lindqvist" }] },
  { code: "q2v6h5tc", url: `${PUBLIC_ORIGIN}/invite/q2v6h5tc`, uses: 0, maxUses: 3, createdAt: iso(60 * 3), joined: [] },
];
let token: string | null = null;
let counter = 1000;

const current = (): User => {
  const id = token ? sessions.get(token) : undefined;
  const user = [...users.values()].find((u) => u.id === id);
  if (!user) throw new ApiError("unauthorized", "Please sign in again.");
  return user;
};

const edges = new Set<string>([
  "mina>jonas_w", "mina>tamsin", "mina>koji", "jonas_w>mina", "tamsin>mina", "tamsin>noor", "koji>mina", "koji>noor",
  "ila_makes>mina", "ila_makes>jonas_w", "odd_type>tamsin", "noor>koji", "bram>jonas_w", "bram>ila_makes",
]);
const blocked = new Set<string>();
const muted = new Set<string>();
const handleOf = (u: User) => u.handle;
const pairOf = (a: string, b: string) => `${a}>${b}`;

const decorate = (u: User): User => {
  const me = token ? [...users.values()].find((x) => x.id === sessions.get(token!))?.handle : undefined;
  const all = [...edges];
  const base = { ...u, followers: all.filter((e) => e.endsWith(`>${u.handle}`)).length, following: all.filter((e) => e.startsWith(`${u.handle}>`)).length };
  return me ? { ...base, viewer: { following: edges.has(pairOf(me, u.handle)), blocked: blocked.has(u.handle), muted: muted.has(u.handle) } } : base;
};

const meHandle = () => current().handle;

const find = (handle: string): User => {
  const user = users.get(handle.toLowerCase());
  if (!user) throw new ApiError("not_found", `Nobody here goes by @${handle}.`);
  return user;
};

const target = (handle: string): User => {
  const user = find(handle);
  if (user.handle === meHandle()) throw new ApiError("self", "You cannot do that to yourself.");
  return user;
};

const pageOf = (handles: string[], cursor?: string | null): UserPage => {
  const start = cursor ? Number(cursor) : 0;
  const list = handles.slice(start, start + 20).map((h) => decorate(users.get(h)!));
  return { users: list, cursor: start + 20 < handles.length ? String(start + 20) : null };
};

const likes = new Map<string, Set<string>>();
const comments: { id: string; postId: string; parentId: string | null; userId: string; body: string; createdAt: string }[] = [];
const notes: { id: string; kind: Notification["kind"]; actor: string; count: number; postId: string | null; commentId: string | null; createdAt: string; read: boolean }[] = [];
const COMMENT_MAX = 500;

const seedLikes: [number, string[]][] = [
  [0, ["jonas_w", "tamsin", "koji", "noor", "bram"]],
  [2, ["mina", "ila_makes"]],
  [3, ["mina", "noor", "odd_type"]],
  [4, ["koji"]],
];
for (const [i, who] of seedLikes) likes.set(posts[i].id, new Set(who.map((h) => users.get(h)!.id)));
const seedComments: [number, string, string, number, string?][] = [
  [0, "jonas_w", "That blue is unreal. What time did you set out?", 90],
  [0, "mina", "Left at five, the light lasted about twenty minutes.", 60, "c_1"],
  [0, "tamsin", "Saving this for a colour study.", 40],
  [2, "koji", "The window light is doing so much here.", 100],
  [0, "jonas_w", "Twenty minutes. Worth the early alarm.", 25, "c_1"],
];
seedComments.forEach(([i, handle, body, ago, parentId], n) => {
  comments.push({ id: `c_${n + 1}`, postId: posts[i].id, parentId: parentId ?? null, userId: users.get(handle)!.id, body, createdAt: iso(ago) });
});

const view = (p: Post): Post => {
  const me = token ? sessions.get(token) : undefined;
  return { ...p, likeCount: likes.get(p.id)?.size ?? 0, commentCount: comments.filter((c) => c.postId === p.id).length, viewer: { liked: !!me && !!likes.get(p.id)?.has(me) } };
};

const userById = (id: string) => [...users.values()].find((u) => u.id === id)!;
const commentView = (c: (typeof comments)[number]): Comment => ({
  id: c.id,
  postId: c.postId,
  parentId: c.parentId,
  author: userById(c.userId),
  body: c.body,
  createdAt: c.createdAt,
  replies: comments.filter((r) => r.parentId === c.id).map((r) => ({ ...commentView(r), replies: [] })),
});

const pushNote = (kind: Notification["kind"], actor: string, postId: string | null, commentId: string | null, ago: number, count = 1) => {
  notes.push({ id: `n_${notes.length + 1}`, kind, actor, count, postId, commentId, createdAt: iso(ago), read: false });
};
pushNote("like", "jonas_w", posts[0].id, null, 12, 3);
pushNote("comment", "tamsin", posts[0].id, "c_3", 35);
pushNote("reply", "jonas_w", posts[0].id, "c_5", 25);
pushNote("like", "noor", posts[8].id, null, 180, 2);
pushNote("follow", "ila_makes", null, null, 900);
pushNote("follow", "koji", null, null, 300);

const noteView = (n: (typeof notes)[number]): Notification => {
  const post = n.postId ? posts.find((p) => p.id === n.postId) : undefined;
  return {
    id: n.id,
    kind: n.kind,
    actor: users.get(n.actor)!,
    count: n.count,
    postId: n.postId,
    thumbUrl: post ? post.media[0].url : null,
    commentId: n.commentId,
    preview: n.commentId ? (comments.find((c) => c.id === n.commentId)?.body ?? null) : null,
    createdAt: n.createdAt,
    read: n.read,
  };
};

const sorted = () => [...posts].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

export const mock: Backend & { _setToken: (t: string | null) => void; _demoSession: () => { token: string; user: User } } = {
  ...makeMockChat({ current, users, blocked, muted }),
  _setToken: (t) => {
    token = t;
  },
  _demoSession: () => {
    const user = users.get("mina")!;
    const t = `mock_${hex(24)}`;
    sessions.set(t, user.id);
    token = t;
    return { token: t, user };
  },
  async authStart(email, invite) {
    await wait();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError("bad_email", "That email doesn't look right.");
    if (invitesRequired && !emails.has(email)) {
      const code = (invite ?? "").trim().toUpperCase();
      if (!code) throw new ApiError("invite_required", `${brand.name} is invite-only right now. Enter an invite code from a friend.`);
      if (!invites.has(code)) throw new ApiError("invite_invalid", "That invite is not valid or was already used.");
    }
  },
  async authVerify(email, code) {
    await wait();
    if (!/^\d{6}$/.test(code)) throw new ApiError("bad_code", "Enter the 6-digit code.");
    let id = emails.get(email);
    const isNew = !id;
    if (!id) {
      id = `u_${++counter}`;
      emails.set(email, id);
      users.set(`pending_${id}`, { id, handle: "", displayName: "", bio: "", avatarUrl: null, createdAt: iso(0) });
    }
    const user = [...users.values()].find((u) => u.id === id)!;
    const t = `mock_${hex(24)}`;
    sessions.set(t, id);
    token = t;
    return { token: t, user, isNew };
  },
  async setHandle({ handle, displayName }) {
    await wait();
    const me = current();
    if (!HANDLE_RE.test(handle)) throw new ApiError("bad_handle", "Use 3 to 20 letters, numbers or underscores.");
    if (users.has(handle)) throw new ApiError("handle_taken", `@${handle} is taken. Try another.`);
    users.delete(`pending_${me.id}`);
    const user = { ...me, handle, displayName: displayName.trim() || handle };
    users.set(handle, user);
    return user;
  },
  async me() {
    await wait(120);
    return current();
  },
  async logout() {
    if (token) sessions.delete(token);
    token = null;
  },
  async feed(cursor, mode?: FeedMode) {
    await wait();
    const me = token && sessions.has(token) ? meHandle() : null;
    const all = sorted().filter((p) => {
      const h = handleOf(p.author);
      if (me && (blocked.has(h) || muted.has(h))) return false;
      return mode === "following" ? !!me && edges.has(pairOf(me, h)) : true;
    });
    const start = cursor ? Number(cursor) : 0;
    const page = all.slice(start, start + 20).map(view);
    return { posts: page, cursor: start + 20 < all.length ? String(start + 20) : null };
  },
  async post(id) {
    await wait(150);
    const p = posts.find((x) => x.id === id);
    if (!p) throw new ApiError("not_found", "That post isn't here anymore.");
    return view(p);
  },
  async deletePost(id) {
    await wait();
    const me = current();
    const i = posts.findIndex((p) => p.id === id);
    if (i < 0 || posts[i].author.id !== me.id) throw new ApiError("forbidden", "You can only delete your own posts.");
    posts.splice(i, 1);
  },
  async profile(handle) {
    await wait();
    const user = users.get(handle.toLowerCase());
    if (!user) throw new ApiError("not_found", `Nobody here goes by @${handle}.`);
    return { user: decorate(user), posts: sorted().filter((p) => p.author.handle === user.handle).map(view), cursor: null };
  },
  async uploadMedia(file: PickedFile) {
    await wait(500);
    const me = current();
    return makeMedia(me.handle, file.width || 1200, file.height || 1200, file.kind, file.uri, new Date().toISOString(), file.mimeType);
  },
  async createPost({ mediaIds, caption, alt }) {
    await wait();
    const me = current();
    const id = `p_${++counter}`;
    const media = pending.filter((m) => mediaIds.includes(m.id)).map((m) => ({ ...m, alt: alt?.[m.id]?.trim() ?? "" }));
    if (!media.length) throw new ApiError("bad_request", "Add at least one photo or video.");
    const post: Post = { id, author: me, caption: caption.trim(), media, createdAt: new Date().toISOString(), url: `${PUBLIC_ORIGIN}/p/${id}`, likeCount: 0, commentCount: 0, viewer: { liked: false } };
    posts.unshift(post);
    return view(post);
  },
  async listInvites() {
    await wait();
    current();
    return { invites: [...mockInvites], limit: MOCK_INVITE_LIMIT };
  },
  async createInvite(maxUses = 1) {
    await wait();
    const me = current();
    if (mockInvites.length >= MOCK_INVITE_LIMIT) throw new ApiError("invite_limit", `You have made ${MOCK_INVITE_LIMIT} invites, the most one person can have.`);
    const code = hex(8);
    invites.set(code.toUpperCase(), me.handle);
    const url = `${PUBLIC_ORIGIN}/invite/${code}`;
    mockInvites.unshift({ code, url, uses: 0, maxUses, createdAt: new Date().toISOString(), joined: [] });
    return { code, url };
  },
  async report({ url }) {
    await wait();
    if (!/^https?:\/\/\S+\.\S+/.test(url)) throw new ApiError("bad_url", "Paste the full link, starting with https://");
  },
  async follow(handle) {
    await wait(160);
    const user = target(handle);
    if (blocked.has(user.handle)) throw new ApiError("blocked", "Unblock this account to follow it.");
    edges.add(pairOf(meHandle(), user.handle));
    return decorate(user);
  },
  async unfollow(handle) {
    await wait(160);
    const user = target(handle);
    edges.delete(pairOf(meHandle(), user.handle));
    return decorate(user);
  },
  async followers(handle, cursor) {
    await wait();
    const user = find(handle);
    return pageOf([...edges].filter((e) => e.endsWith(`>${user.handle}`)).map((e) => e.split(">")[0]).filter((h) => !blocked.has(h) && users.has(h)), cursor);
  },
  async following(handle, cursor) {
    await wait();
    const user = find(handle);
    return pageOf([...edges].filter((e) => e.startsWith(`${user.handle}>`)).map((e) => e.split(">")[1]).filter((h) => !blocked.has(h) && users.has(h)), cursor);
  },
  async block(handle) {
    await wait(160);
    const user = target(handle);
    blocked.add(user.handle);
    edges.delete(pairOf(meHandle(), user.handle));
    edges.delete(pairOf(user.handle, meHandle()));
    return decorate(user);
  },
  async unblock(handle) {
    await wait(160);
    const user = target(handle);
    blocked.delete(user.handle);
    return decorate(user);
  },
  async mute(handle) {
    await wait(160);
    const user = target(handle);
    muted.add(user.handle);
    return decorate(user);
  },
  async unmute(handle) {
    await wait(160);
    const user = target(handle);
    muted.delete(user.handle);
    return decorate(user);
  },
  async blocks(cursor) {
    await wait();
    return pageOf([...blocked], cursor);
  },
  async mutes(cursor) {
    await wait();
    return pageOf([...muted], cursor);
  },
  async like(postId) {
    await wait(120);
    const me = current();
    if (!posts.some((p) => p.id === postId)) throw new ApiError("not_found", "That post isn't here anymore.");
    const set = likes.get(postId) ?? new Set<string>();
    set.add(me.id);
    likes.set(postId, set);
    return { liked: true, likeCount: set.size };
  },
  async unlike(postId) {
    await wait(120);
    const me = current();
    const set = likes.get(postId);
    set?.delete(me.id);
    return { liked: false, likeCount: set?.size ?? 0 };
  },
  async comments(postId) {
    await wait();
    const top = comments.filter((c) => c.postId === postId && !c.parentId).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    return { comments: top.map(commentView), cursor: null, total: comments.filter((c) => c.postId === postId).length };
  },
  async addComment({ postId, body, parentId }) {
    await wait(200);
    const me = current();
    const text = body.trim();
    if (!text) throw new ApiError("bad_comment", "Write something first.");
    if (text.length > COMMENT_MAX) throw new ApiError("comment_too_long", `Comments can be up to ${COMMENT_MAX} characters.`);
    if (!posts.some((p) => p.id === postId)) throw new ApiError("not_found", "That post isn't here anymore.");
    const row = { id: `c_${++counter}`, postId, parentId: parentId ?? null, userId: me.id, body: text, createdAt: new Date().toISOString() };
    comments.push(row);
    return commentView(row);
  },
  async deleteComment(id) {
    await wait(150);
    const me = current();
    const row = comments.find((c) => c.id === id);
    if (!row) throw new ApiError("not_found", "No such comment.");
    const post = posts.find((p) => p.id === row.postId);
    if (row.userId !== me.id && post?.author.id !== me.id) throw new ApiError("forbidden", "Only the commenter or the post author can delete this comment.");
    for (let i = comments.length - 1; i >= 0; i--) if (comments[i].id === id || comments[i].parentId === id) comments.splice(i, 1);
  },
  async notifications() {
    await wait();
    current();
    const list = [...notes].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return { notifications: list.map(noteView), cursor: null, unread: notes.filter((n) => !n.read).length };
  },
  async unreadCount() {
    await wait(80);
    current();
    return notes.filter((n) => !n.read).length;
  },
  async markNotificationsRead(ids) {
    await wait(80);
    current();
    for (const n of notes) if (!ids || ids.includes(n.id)) n.read = true;
    return notes.filter((n) => !n.read).length;
  },
  async search(q, kind) {
    await wait();
    const words = q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    const hit = (text: string) => words.every((w) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).some((t) => t.startsWith(w)));
    if (!words.length) return { users: [], posts: [], cursor: null };
    if (kind === "people") return { users: [...users.values()].filter((u) => u.handle && hit(`${u.handle} ${u.displayName} ${u.bio}`)), posts: [], cursor: null };
    return { users: [], posts: sorted().filter((p) => hit(`${p.caption} ${p.media.map((m) => m.alt ?? "").join(" ")}`)), cursor: null };
  },
  async updateProfile(input) {
    await wait();
    const me = current();
    if (input.displayName !== undefined && !input.displayName.trim()) throw new ApiError("bad_name", "Names can be 1 to 50 characters.");
    if (input.bio !== undefined && input.bio.length > 280) throw new ApiError("bad_bio", "Bios can be up to 280 characters.");
    if (input.links?.some((l) => !/^https?:\/\/\S+\.\S+/.test(l))) throw new ApiError("bad_links", "Each link must start with http:// or https://");
    const avatar = input.avatarMediaId === undefined ? me.avatarUrl : input.avatarMediaId === null ? null : (pending.find((m) => m.id === input.avatarMediaId)?.url ?? me.avatarUrl);
    Object.assign(me, {
      displayName: input.displayName === undefined ? me.displayName : input.displayName.trim(),
      bio: input.bio === undefined ? me.bio : input.bio.trim(),
      links: input.links ?? me.links,
      avatarUrl: avatar,
    });
    return me;
  },
  async flag({ targetType, targetId }) {
    await wait();
    const me = current();
    const own = targetType === "post" ? posts.find((p) => p.id === targetId)?.author.id === me.id : targetId === me.id;
    if (own) throw new ApiError("own_content", "You cannot report your own posts or account.");
  },
  fund: async () => ({
    banners: [{ name: "Quillfern Paper", url: null, line: "Paper for people who draw" }],
    feedCards: { on: false, posts: 0, needed: 0, every: 8 },
  }),
};

const pending: Media[] = [];
const upload = mock.uploadMedia;
mock.uploadMedia = async (file) => {
  const m = await upload(file);
  pending.push(m);
  return m;
};
