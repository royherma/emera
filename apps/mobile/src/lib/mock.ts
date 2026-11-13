import brand from "./brand";
import { PUBLIC_ORIGIN } from "./config";
import { ApiError, Backend, Media, PickedFile, Post, User } from "./types";
import { HANDLE_RE } from "./format";

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
people.forEach(([handle, displayName, bio], i) => {
  users.set(handle, { id: `u_${i + 1}`, handle, displayName, bio, avatarUrl: null, createdAt: iso(60 * 24 * (40 + i)) });
});

type Seed = [string, string, number, number, number, "image" | "video"?];
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
    media: [makeMedia(handle, w * 400, h * 400, kind ?? "image", `mock:art/${id}`, createdAt)],
  };
});
posts[0].media.push(makeMedia("mina", 1600, 2000, "image", "mock:art/p_100b", posts[0].createdAt));
posts[0].media.push(makeMedia("mina", 1600, 2000, "image", "mock:art/p_100c", posts[0].createdAt));

const sessions = new Map<string, string>();
const emails = new Map<string, string>();
const invites = new Map<string, string>([[MOCK_INVITE_CODE, "mina"]]);
let token: string | null = null;
let counter = 1000;

const current = (): User => {
  const id = token ? sessions.get(token) : undefined;
  const user = [...users.values()].find((u) => u.id === id);
  if (!user) throw new ApiError("unauthorized", "Please sign in again.");
  return user;
};

const sorted = () => [...posts].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

export const mock: Backend & { _setToken: (t: string | null) => void } = {
  _setToken: (t) => {
    token = t;
  },
  async authStart(email) {
    await wait();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError("bad_email", "That email doesn't look right.");
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
  async setHandle({ handle, displayName, inviteCode }) {
    await wait();
    const me = current();
    if (invitesRequired && !invites.has((inviteCode ?? "").trim().toUpperCase())) {
      throw new ApiError("invite_required", `${brand.name} is invite-only right now. Enter an invite code from a friend.`);
    }
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
  async feed(cursor) {
    await wait();
    const all = sorted();
    const start = cursor ? Number(cursor) : 0;
    const page = all.slice(start, start + 20);
    return { posts: page, cursor: start + 20 < all.length ? String(start + 20) : null };
  },
  async post(id) {
    await wait(150);
    const p = posts.find((x) => x.id === id);
    if (!p) throw new ApiError("not_found", "That post isn't here anymore.");
    return p;
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
    return { user, posts: sorted().filter((p) => p.author.handle === user.handle), cursor: null };
  },
  async uploadMedia(file: PickedFile) {
    await wait(500);
    const me = current();
    return makeMedia(me.handle, file.width || 1200, file.height || 1200, file.kind, file.uri, new Date().toISOString(), file.mimeType);
  },
  async createPost({ mediaIds, caption }) {
    await wait();
    const me = current();
    const id = `p_${++counter}`;
    const media = pending.filter((m) => mediaIds.includes(m.id));
    if (!media.length) throw new ApiError("bad_request", "Add at least one photo or video.");
    const post: Post = { id, author: me, caption: caption.trim(), media, createdAt: new Date().toISOString(), url: `${PUBLIC_ORIGIN}/p/${id}` };
    posts.unshift(post);
    return post;
  },
  async createInvite() {
    await wait();
    const me = current();
    const code = hex(8).toUpperCase();
    invites.set(code, me.handle);
    return { code, url: `${PUBLIC_ORIGIN}/join/${code}` };
  },
};

const pending: Media[] = [];
const upload = mock.uploadMedia;
mock.uploadMedia = async (file) => {
  const m = await upload(file);
  pending.push(m);
  return m;
};
