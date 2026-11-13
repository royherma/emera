import { ApiError, Backend, Channel, ChatMessage, ChatRoomRef, ChatSettings, ChatUser, DmThread, Post, User } from "./types";

type ChatBackend = Pick<Backend, "channels" | "roomMessages" | "sendMessage" | "deleteMessage" | "markRoomRead" | "flagMessage" | "threads" | "startThread" | "acceptThread" | "hideThread" | "dmUnread" | "liveUrl" | "chatSettings" | "saveChatSettings" | "dmWith" | "muteThread">;
type Deps = { current: () => User; users: Map<string, User>; blocked: Set<string>; muted: Set<string>; postById: (id: string) => Post | null };
type MockMsg = ChatMessage & { room: string; at: number; byMe?: boolean };

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms + Math.random() * 120));
const minutesAgo = (m: number) => Date.now() - m * 60000;

export function makeMockChat({ current, users, blocked, muted, postById }: Deps): ChatBackend {
  let settings: ChatSettings = { dmFrom: "everyone", channelsHidden: false };
  const chatUser = (u: User): ChatUser => ({ id: u.id, handle: u.handle, displayName: u.displayName, avatarUrl: u.avatarUrl });
  const byHandle = (h: string) => chatUser(users.get(h)!);
  const channels: Channel[] = [
    { id: "lobby", name: "lobby", topic: "Say hi and meet the people here", slowSeconds: 0, unread: true },
    { id: "feedback", name: "feedback", topic: "Bugs, ideas and what we should build next", slowSeconds: 0, unread: false },
    { id: "news", name: "news", topic: "What is happening where you are", slowSeconds: 0, unread: true },
  ];
  const seed: [string, string, string, number][] = [
    ["lobby", "mina", "morning from Lisbon, the light is unreal today", 52],
    ["lobby", "jonas_w", "first kiln of the week is loading. anyone else fire on Mondays?", 44],
    ["lobby", "tamsin", "hi all, just joined. illustrator, mostly gouache", 31],
    ["lobby", "noor", "welcome Tamsin! post the window seat piece here too", 29],
    ["lobby", "koji", "is there a way to pin a post to my profile yet?", 12],
    ["lobby", "bram", "same question, I'd pin the walnut stool", 9],
    ["feedback", "odd_type", "upload was quick on a 40 MB video, nice", 140],
    ["feedback", "ila_makes", "would love a way to sort my grid by colour", 95],
    ["news", "mina", "Lisbon print fair is on this Saturday at LX Factory", 220],
    ["news", "jonas_w", "the clay supplier in Porto reopened after the flood", 70],
  ];
  let n = 0;
  const msgs: MockMsg[] = seed.map(([room, h, body, ago]) => ({ id: `cm_${n++}`, room: `c:${room}`, user: byHandle(h), body, createdAt: new Date(minutesAgo(ago)).toISOString(), at: minutesAgo(ago), mine: false, deleted: false }));
  const threads: (DmThread & { hidden?: boolean })[] = [];
  const seedDm = (h: string, accepted: boolean, lines: [boolean, string, number][]) => {
    const id = `dm_${h}`;
    for (const [byMe, body, ago] of lines) msgs.push({ id: `cm_${n++}`, room: `d:${id}`, user: byHandle(h), byMe, body, createdAt: new Date(minutesAgo(ago)).toISOString(), at: minutesAgo(ago), mine: false, deleted: false });
    threads.push({ id, with: byHandle(h), accepted, theyAccepted: true, lastAt: "", last: null, unread: !lines[lines.length - 1][0] });
  };
  seedDm("mina", true, [[false, "loved your last post, what lens was that?", 180], [true, "thanks! a 35mm, nothing fancy", 170], [false, "up for a photo walk next week?", 25]]);
  seedDm("koji", false, [[false, "hi, I'm making a short film and need a poster. open to commissions?", 60]]);

  const key = (r: ChatRoomRef) => `${r.kind === "dm" ? "d" : "c"}:${r.id}`;
  const view = (m: MockMsg): ChatMessage => {
    const me = current();
    const mine = m.byMe || m.user.id === me.id;
    const postId = m.deleted ? null : (m.postId ?? null);
    return { id: m.id, user: mine ? chatUser(me) : m.user, body: m.deleted ? "" : m.body, createdAt: m.createdAt, mine, deleted: m.deleted, postId, post: postId ? postById(postId) : null };
  };
  const inRoom = (r: ChatRoomRef) => msgs.filter((m) => m.room === key(r)).sort((a, b) => a.at - b.at);
  const threadView = (t: DmThread): DmThread => {
    const last = inRoom({ kind: "dm", id: t.id }).pop();
    const { hidden: _h, ...rest } = t as DmThread & { hidden?: boolean };
    return { ...rest, lastAt: last?.createdAt ?? new Date().toISOString(), last: last ? { body: last.deleted ? "" : last.body.slice(0, 80) || (last.postId ? "Sent a post" : ""), mine: view(last).mine, deleted: last.deleted } : null };
  };
  const hiddenUser = (m: MockMsg) => !!m.user.handle && (blocked.has(m.user.handle) || muted.has(m.user.handle));

  const api: ChatBackend = {
    async channels() {
      await wait(40);
      return channels.map((c) => ({ ...c }));
    },
    async roomMessages(room, page) {
      await wait(40);
      current();
      const thread = room.kind === "dm" ? threads.find((t) => t.id === room.id) : undefined;
      if (room.kind === "dm" && !thread) throw new ApiError("not_found", "No such conversation.");
      const all = inRoom(room).filter((m) => !hiddenUser(m));
      const after = page?.after ? Number(page.after) : null;
      const list = after !== null ? all.filter((m) => m.at > after) : all.slice(-50);
      const last = list[list.length - 1];
      return { messages: list.map(view), before: null, latest: last ? String(last.at) : (page?.after ?? null), moderator: false, thread: thread && threadView(thread) };
    },
    async sendMessage(room, body, postId) {
      await wait();
      const me = current();
      const text = body.trim();
      if (!text && !postId) throw new ApiError("bad_message", "Write something first.");
      if (text.length > 2000) throw new ApiError("message_too_long", "Messages can be up to 2000 characters.");
      const at = Date.now();
      const m: MockMsg = { id: `cm_${n++}`, room: key(room), user: chatUser(me), byMe: true, body: text, postId: postId ?? null, createdAt: new Date(at).toISOString(), at, mine: true, deleted: false };
      msgs.push(m);
      const t = threads.find((x) => x.id === room.id);
      if (t) Object.assign(t, { accepted: true, hidden: false, unread: false });
      return view(m);
    },
    async deleteMessage(_room, id) {
      await wait(60);
      const m = msgs.find((x) => x.id === id);
      if (m) m.deleted = true;
    },
    async markRoomRead(room) {
      const ch = channels.find((c) => c.id === room.id);
      if (room.kind === "channel" && ch) ch.unread = false;
      const t = threads.find((x) => x.id === room.id);
      if (t) t.unread = false;
    },
    async flagMessage() {
      await wait();
    },
    async threads(box) {
      await wait();
      current();
      return threads
        .filter((t) => !t.hidden && t.accepted === (box === "inbox") && !(t.with.handle && blocked.has(t.with.handle)))
        .map(threadView)
        .sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt));
    },
    async startThread(handle, body, postId) {
      await wait();
      const me = current();
      if (handle === me.handle) throw new ApiError("self", "You cannot message yourself.");
      if (!users.has(handle)) throw new ApiError("not_found", "No such account.");
      if (blocked.has(handle)) throw new ApiError("cant_message", "You can't message this account.");
      let t = threads.find((x) => x.with.handle === handle);
      if (!t) {
        t = { id: `dm_${handle}`, with: byHandle(handle), accepted: true, theyAccepted: false, lastAt: "", last: null, unread: false };
        threads.push(t);
      }
      const message = await api.sendMessage({ kind: "dm", id: t.id }, body, postId);
      return { thread: threadView(t), message };
    },
    async acceptThread(id) {
      const t = threads.find((x) => x.id === id);
      if (!t) throw new ApiError("not_found", "No such conversation.");
      t.accepted = true;
      return threadView(t);
    },
    async hideThread(id) {
      const t = threads.find((x) => x.id === id);
      if (t) Object.assign(t, { hidden: true, unread: false });
    },
    async dmUnread() {
      await wait(40);
      const open = threads.filter((t) => !t.hidden && t.unread && !t.muted);
      return { inbox: open.filter((t) => t.accepted).length, requests: open.filter((t) => !t.accepted).length };
    },
    async liveUrl() {
      return null;
    },
    async chatSettings() {
      return { ...settings };
    },
    async saveChatSettings(input) {
      await wait(60);
      settings = { ...settings, ...input };
      return { ...settings };
    },
    async dmWith(handle) {
      await wait(60);
      const u = users.get(handle);
      if (!u || handle === current().handle) throw new ApiError("not_found", "No such account.");
      const t = threads.find((x) => x.with.handle === handle && !x.hidden);
      const blockedNow = blocked.has(handle);
      return { user: chatUser(u), thread: t ? threadView(t) : null, canMessage: !blockedNow, reason: blockedNow ? "You can't message this account." : null };
    },
    async muteThread(id, isMuted) {
      const t = threads.find((x) => x.id === id);
      if (!t) throw new ApiError("not_found", "No such conversation.");
      t.muted = isMuted;
      return threadView(t);
    },
  };
  return api;
}
