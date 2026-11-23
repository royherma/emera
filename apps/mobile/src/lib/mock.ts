import brand from "./brand";
import { PUBLIC_ORIGIN } from "./config";
import { ApiError, Backend, FoundCopy, Takedown, TakedownPreview, Comment, FeedMode, ImportSource, Invite, Media, Notification, PickedFile, Post, User, UserPage } from "./types";
import { HANDLE_RE } from "./format";
import { makeMockChat } from "./mockChat";
import { mockEarnings, mockFund, mockFundMonth, mockWatch } from "./fundMock";

const wait = (ms = 280) => new Promise((r) => setTimeout(r, ms + Math.random() * 220));
const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60000).toISOString();
const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");

const invitesRequired = process.env.EXPO_PUBLIC_MOCK_INVITES === "1";
export const MOCK_INVITE_CODE = "DAYLIGHT";

const people: [string, string, string, string][] = [
  ["mina", "Mina Okafor", "Filmmaker and speaker. Lagos, then Lisbon. Making things that keep your name on them.", "Film"],
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
users.get("noor")!.role = "mod";
for (const h of ["mina", "jonas_w", "noor", "tamsin", "koji", "ila_makes", "odd_type", "bram"]) users.get(h)!.avatarUrl = `mock:photo/avatar-${h}`;
users.get("mina")!.role = "creator";

type Seed = [string, string, number, number, number, ("image" | "video")?];
const seeds: Seed[] = [
  ["mina", "Spoke to a full room today. Thank you for every single question", 4, 5, 8],
  ["jonas_w", "Opened the kiln and every glaze held. First time all year", 4, 5, 55],
  ["tamsin", "Window seat, late afternoon. Gouache on cotton paper.", 3, 4, 140],
  ["koji", "Frame from the harbour film. 16mm, expired stock.", 16, 9, 260, "video"],
  ["noor", "Day three of the paper canyon. Still deciding where the light goes", 4, 5, 380],
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
  ["koji", "Rooftop at dusk, one take on the phone.", 9, 16, 30, "video"],
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

const photoFor: Record<string, string> = { p_100: "mina-1", p_101: "jonas-1", p_104: "noor-1", p_102: "tamsin-1", p_103: "koji-1", p_105: "ila-1", p_106: "oddtype-1", p_107: "bram-1", p_108: "mina-4", p_109: "tamsin-2", p_110: "koji-2", p_111: "jonas-2", p_112: "noor-2", p_113: "ila-2", p_114: "bram-2", p_115: "oddtype-2", p_116: "mina-5", p_117: "tamsin-3", p_118: "koji-3" };

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
    viewCount: 0,
    viewer: { liked: false },
    media: [makeMedia(handle, w * 400, h * 400, photoFor[id] ? "image" : (kind ?? "image"), photoFor[id] ? `mock:photo/${photoFor[id]}` : `mock:art/${id}`, createdAt)],
  };
});
posts[0].media.push(makeMedia("mina", 1600, 2000, "image", "mock:photo/mina-2", posts[0].createdAt));
posts[0].media.push(makeMedia("mina", 1600, 2000, "image", "mock:photo/mina-3", posts[0].createdAt));

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
const views = new Map<string, Map<string, number>>();
const plays = new Map<string, number>();
const VIEW_RULE = "A view is one signed-in person who watched at least 2 seconds with half the video on screen. Each person counts once and the maker's own plays don't count. Watching again a minute or more later adds a play to that person's row, not a view.";
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
const watchers = ["jonas_w", "tamsin", "noor", "bram", "mina", "ila_makes", "odd_type"];
posts.filter((p) => p.media.some((m) => m.kind === "video")).forEach((p, i) => {
  const who = watchers.filter((h) => h !== p.author.handle).slice(0, 3 + i * 2);
  views.set(p.id, new Map(who.map((h, j) => [users.get(h)!.id, Date.now() - (j + 1) * 47 * 60_000])));
});
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
  return { ...p, likeCount: likes.get(p.id)?.size ?? 0, viewCount: views.get(p.id)?.size ?? 0, commentCount: comments.filter((c) => c.postId === p.id).length, viewer: { liked: !!me && !!likes.get(p.id)?.has(me) } };
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
  ...makeMockChat({ current, users, blocked, muted, postById: (id) => { const p = posts.find((x) => x.id === id); return p ? view(p) : null; } }),
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
      users.set(`pending_${id}`, { id, handle: "", displayName: "", bio: "", avatarUrl: null, createdAt: iso(0), admin: true });
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
  async adminUsers(q) {
    await wait();
    if (!current().admin) throw new ApiError("not_admin", "Only admins can change roles.");
    const term = q.trim().toLowerCase().replace(/^@/, "");
    return [...users.values()].filter((u) => u.handle && (!term || u.handle.includes(term) || u.displayName.toLowerCase().includes(term)));
  },
  async setRole(handle, role) {
    await wait();
    if (!current().admin) throw new ApiError("not_admin", "Only admins can change roles.");
    const u = users.get(handle);
    if (!u) throw new ApiError("not_found", "No such user.");
    u.role = role === "member" ? null : role;
    posts.forEach((p) => { if (p.author.id === u.id) p.author = { ...p.author, role: u.role }; });
    return u;
  },
  async logout() {
    if (token) sessions.delete(token);
    token = null;
  },
  async deleteAccount() {
    const id = token ? sessions.get(token) : undefined;
    if (id) {
      for (const [k, u] of users) if (u.id === id) users.delete(k);
      for (let i = posts.length - 1; i >= 0; i--) if (posts[i].author.id === id) posts.splice(i, 1);
    }
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
    const post: Post = { id, author: me, caption: caption.trim(), media, createdAt: new Date().toISOString(), url: `${PUBLIC_ORIGIN}/p/${id}`, likeCount: 0, commentCount: 0, viewCount: 0, viewer: { liked: false } };
    posts.unshift(post);
    return view(post);
  },
  async listInvites() {
    await wait();
    current();
    return { invites: [...mockInvites], limit: MOCK_INVITE_LIMIT, open: !invitesRequired };
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
  async report({ postId, url }) {
    await wait();
    if (!/^https?:\/\/\S+\.\S+/.test(url)) throw new ApiError("bad_url", "Paste the full link, starting with https://");
    const id = hex(10);
    mockReports.set(id, { postId, url });
    return { id };
  },
  async takedownPreview(reportId): Promise<TakedownPreview> {
    await wait(160);
    const r = mockReports.get(reportId);
    if (!r) throw new ApiError("not_found", "No such report.");
    const site = mockSite(r.url);
    return {
      takedown: mockTakedowns.find((t) => t.reportId === reportId) ?? null,
      authorization: { required: !mockSigned, version: "2026-11-23.1", text: MOCK_AUTH_TEXT, name: mockSigned },
      recipient: { site, method: MOCK_FORMS.has(site) ? "form" : "email" },
      notice: `Notice of copyright infringement (DMCA, 17 U.S.C. 512(c)(3))\n\n1. The copyrighted work\nThe original work was first published on Emera at ${PUBLIC_ORIGIN}/p/${r.postId}.\n\n2. The infringing material\n${r.url}\n\n3. Statements\n${MOCK_AUTH_TEXT.split("\n").map((l) => `- ${l}`).join("\n")}\n\n4. Contact\nEmera, authorized agent of ${mockSigned ?? "(your full name)"}. Email takedowns@emera.social.\n\n5. Electronic signature\n/${mockSigned ?? "(your full name)"}/`,
    };
  },
  async confirmTakedown(reportId, authorization) {
    await wait();
    const r = mockReports.get(reportId);
    if (!r) throw new ApiError("not_found", "No such report.");
    const had = mockTakedowns.find((t) => t.reportId === reportId);
    if (had) return had;
    if (!mockSigned) {
      if (!authorization) throw new ApiError("authorization_required", "Sign the statement once before we send notices for you.");
      mockSigned = authorization.name;
    }
    const site = mockSite(r.url);
    const t: Takedown = { id: hex(10), reportId, postId: r.postId, url: r.url, site, method: MOCK_FORMS.has(site) ? "form" : "email", status: "ready", rejectReason: null, createdAt: new Date().toISOString(), sentAt: null, removedAt: null, daysToRemoval: null, receiptUrl: null };
    mockTakedowns.unshift(t);
    return t;
  },
  async takedowns() {
    await wait(160);
    return mockTakedowns;
  },
  async protectMe() {
    await wait();
    return { plan: "creator" as const, planUntil: new Date(Date.now() + 20 * 86_400_000).toISOString() };
  },
  async foundCopies() {
    await wait();
    return mockCopies.filter((m) => m.status !== "dismissed");
  },
  async dismissCopy(id) {
    await wait(160);
    const m = mockCopies.find((x) => x.id === id);
    if (m) m.status = "dismissed";
  },
  async takedownCopy(id) {
    await wait();
    const m = mockCopies.find((x) => x.id === id);
    if (!m) throw new ApiError("not_found", "No such match.");
    m.status = "reported";
    m.reportId = hex(5);
    mockReports.set(m.reportId, { postId: m.postId, url: m.url });
    return m;
  },
  async scanNow() {
    await wait();
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
  async view(postId) {
    await wait(60);
    const me = current();
    const post = posts.find((p) => p.id === postId);
    if (!post) throw new ApiError("not_found", "That post isn't here anymore.");
    const seen = views.get(postId) ?? new Map<string, number>();
    if (post.author.id !== me.id) {
      if (seen.has(me.id)) plays.set(`${postId}:${me.id}`, (plays.get(`${postId}:${me.id}`) ?? 1) + 1);
      seen.set(me.id, seen.get(me.id) ?? Date.now());
    }
    views.set(postId, seen);
    return { viewCount: seen.size };
  },
  async views(postId) {
    await wait();
    const seen = [...(views.get(postId) ?? new Map<string, number>())].sort((a, b) => b[1] - a[1]);
    const ledger = seen.map(([id, at], i) => ({ viewer: [...`${postId}:${id}`].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, "0") + String(i).padStart(4, "0"), hour: new Date(Math.floor(at / 3_600_000) * 3_600_000).toISOString(), follower: i % 2 === 0, accountAge: "a month or more", plays: plays.get(`${postId}:${id}`) ?? 1 + (i % 3 === 0 ? 2 : 0), sameDevice: false, sameNetwork: i === 1 || i === 2 }));
    return { postId, viewCount: seen.length, plays: ledger.reduce((n, r) => n + r.plays, 0), followers: ledger.filter((r) => r.follower).length, newAccounts: 0, sameDevice: 0, sameNetwork: ledger.filter((r) => r.sameNetwork).length, rule: VIEW_RULE, ledger, more: false };
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
  async importPreview(from) {
    await wait(600);
    current();
    const label = from.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!label) throw new ApiError("bad_source", "Paste a link or a Bluesky handle.");
    if (/instagram\.com|tiktok\.com/i.test(from)) throw new ApiError("source_locked", "Instagram and TikTok do not share posts with other apps. Download your data there and bring the files in one by one.");
    const items = posts.filter((p) => p.media[0]?.kind !== "video").slice(0, 6).map((p) => ({ id: `mock:${p.id}`, url: p.url, date: p.createdAt, caption: p.caption, photos: p.media.length, videos: 0, thumb: p.media[0]?.url ?? null, onEmera: imported.has(`mock:${p.id}`) ? p.id : null }));
    return { label, items };
  },
  async connectors() {
    return {
      connectors: [{ id: "bluesky", name: "Bluesky", example: "@you.bsky.social" }, { id: "mastodon", name: "Mastodon", example: "https://mastodon.social/@you" }, { id: "feed", name: "RSS or Atom feed", example: "https://yourblog.com/feed" }],
      locked: [{ name: "Instagram", why: "Instagram does not share posts with other apps." }, { name: "TikTok", why: "TikTok does not share posts with other apps." }],
    };
  },
  async importPosts({ from, limit = 10, only, autoPost, rules }) {
    const { items } = await mock.importPreview(from);
    const me = current();
    let n = 0;
    for (const it of items.filter((i) => !only || only.includes(i.id)).slice(0, only ? 50 : limit)) {
      if (imported.has(it.id)) continue;
      const src = posts.find((p) => `mock:${p.id}` === it.id)!;
      const id = `p_${++counter}`;
      posts.unshift({ ...src, id, author: me, url: `${PUBLIC_ORIGIN}/p/${id}`, likeCount: 0, commentCount: 0, viewer: { liked: false } });
      imported.add(it.id);
      n++;
    }
    if (autoPost) await mock.setSource(from, true, rules);
    return { imported: n, skipped: [] };
  },
  async sources() {
    await wait();
    current();
    return [...sources];
  },
  async setSource(from, autoPost, rules) {
    await wait();
    current();
    const label = from.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    let s = sources.find((x) => x.from === from);
    if (!s) sources.push((s = { id: hex(8), from, kind: /bsky|^@/.test(from) ? "bluesky" : "feed", label, autoPost, rules: { media: "any" }, since: new Date().toISOString(), lastChecked: null, lastError: null }));
    s.autoPost = autoPost;
    if (rules) s.rules = rules;
    return { ...s };
  },
  async removeSource(id) {
    await wait();
    const i = sources.findIndex((s) => s.id === id);
    if (i >= 0) sources.splice(i, 1);
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
  async fundPage() {
    await wait(160);
    return mockFund();
  },
  async fundMonth(month) {
    await wait(160);
    return mockFundMonth(month);
  },
  async earnings() {
    await wait(160);
    const me = current();
    return mockEarnings(me.handle, sorted().filter((p) => p.author.id === me.id).map(view));
  },
  async watch(postId, seconds) {
    const me = current();
    const p = posts.find((x) => x.id === postId);
    if (!p) throw new ApiError("not_found", "That post isn't here anymore.");
    return mockWatch(postId, p.author.handle, me.handle, seconds);
  },
};

const pending: Media[] = [];
const imported = new Set<string>();
const MOCK_AUTH_TEXT = [
  "I have a good faith belief that the use of my work at the web addresses I report is not authorized by me, my agent, or the law.",
  "The information I give in each notice is accurate.",
  "Under penalty of perjury, I am the owner of the work, or I am authorized to act on behalf of the owner of the exclusive right that is allegedly infringed.",
  "I authorize Emera to send copyright notices for me, as my agent, about the copies I confirm.",
].join("\n");
const MOCK_FORMS = new Set(["instagram.com", "facebook.com", "tiktok.com", "youtube.com", "pinterest.com", "etsy.com", "redbubble.com", "amazon.com", "x.com", "reddit.com"]);
const mockSite = (url: string) => (url.match(/^https?:\/\/(?:www\.)?([^/]+)/)?.[1] ?? "").split(".").slice(-2).join(".");
const mockReports = new Map<string, { postId: string; url: string }>();
let mockSigned: string | null = null;
const mockTakedowns: Takedown[] = [
  { id: "tdmock0001", reportId: "rmock1", postId: "mock", url: "https://prints.example.org/listing/88", site: "example.org", method: "email", status: "removed", rejectReason: null, createdAt: iso(60 * 24 * 6), sentAt: iso(60 * 24 * 5), removedAt: iso(60 * 24 * 3), daysToRemoval: 3, receiptUrl: `${PUBLIC_ORIGIN}/takedown/tdmock0001` },
  { id: "tdmock0002", reportId: "rmock2", postId: "mock", url: "https://www.etsy.com/listing/204", site: "etsy.com", method: "form", status: "sent", rejectReason: null, createdAt: iso(60 * 24 * 2), sentAt: iso(60 * 24), removedAt: null, daysToRemoval: null, receiptUrl: null },
];

const mockCopies: FoundCopy[] = [
  { id: "mc1", postId: "mock", url: "https://prints.example.org/listing/204", title: "Sunrise over the harbour, canvas print", site: "Example Prints", thumbnail: null, reason: "Lens visual match on Example Prints", status: "new", reportId: null, foundAt: new Date(Date.now() - 3_600_000).toISOString() },
  { id: "mc2", postId: "mock", url: "https://blog.example.net/best-photos", title: "Best photos of the year", site: "Example Blog", thumbnail: null, reason: "Lens exact match on Example Blog", status: "new", reportId: null, foundAt: new Date(Date.now() - 86_400_000).toISOString() },
];
const sources: ImportSource[] = [];
const upload = mock.uploadMedia;
mock.uploadMedia = async (file) => {
  const m = await upload(file);
  pending.push(m);
  return m;
};
