export type User = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  links?: string[];
  avatarUrl: string | null;
  createdAt: string;
  category?: string;
  followers?: number;
  following?: number;
  viewer?: { following: boolean; blocked: boolean; muted: boolean };
};

export type FeedMode = "all" | "following";
export type UserPage = { users: User[]; cursor: string | null };

export type Proof = { sha256: string; signedAt: string; signer: string };

export type Media = {
  id: string;
  kind: "image" | "video";
  contentType: string;
  width: number;
  height: number;
  url: string;
  posterUrl?: string | null;
  captionsUrl?: string | null;
  alt?: string;
  sha256: string;
  proof: Proof;
};

export type Post = {
  id: string;
  author: User;
  caption: string;
  media: Media[];
  createdAt: string;
  url: string;
  likeCount: number;
  commentCount: number;
  viewer: { liked: boolean };
};

export type Comment = { id: string; postId: string; parentId: string | null; author: User; body: string; createdAt: string; replies: Comment[] };

export type NotificationKind = "like" | "comment" | "reply" | "follow";

export type Notification = {
  id: string;
  kind: NotificationKind;
  actor: User;
  count: number;
  postId: string | null;
  thumbUrl: string | null;
  commentId: string | null;
  preview: string | null;
  createdAt: string;
  read: boolean;
};

export type Invite = {
  code: string;
  url: string;
  uses: number;
  maxUses: number;
  createdAt: string;
  joined: { handle: string; displayName: string }[];
};

export type FlagReason = "spam" | "harassment" | "hate" | "violence" | "nudity" | "self_harm" | "impersonation" | "scam" | "other";

export type SearchKind = "people" | "posts";

export type ChatUser = { id: string; handle: string | null; displayName: string; avatarUrl: string | null };
export type ChatMessage = { id: string; user: ChatUser; body: string; createdAt: string; mine: boolean; deleted: boolean };
export type Channel = { id: string; name: string; topic: string; slowSeconds: number; unread: boolean };
export type DmThread = { id: string; with: ChatUser; accepted: boolean; theyAccepted: boolean; lastAt: string; last: { body: string; mine: boolean; deleted: boolean } | null; unread: boolean };
export type ChatPage = { messages: ChatMessage[]; before: string | null; latest: string | null; moderator?: boolean; thread?: DmThread };
export type ChatRoomRef = { kind: "channel" | "dm"; id: string };

export type PickedFile = { uri: string; mimeType: string; fileSize: number; width: number; height: number; kind: "image" | "video"; seconds?: number };

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface Sponsor {
  name: string;
  url: string | null;
  line: string | null;
}

export interface FundCards {
  banners: Sponsor[];
  feedCards: { on: boolean; posts: number; needed: number; every: number };
}

export interface Backend {
  authStart(email: string, invite?: string): Promise<void>;
  authVerify(email: string, code: string): Promise<{ token: string; user: User; isNew: boolean }>;
  setHandle(input: { handle: string; displayName: string }): Promise<User>;
  me(): Promise<User>;
  logout(): Promise<void>;
  feed(cursor?: string | null, mode?: FeedMode): Promise<{ posts: Post[]; cursor: string | null }>;
  post(id: string): Promise<Post>;
  deletePost(id: string): Promise<void>;
  profile(handle: string, cursor?: string | null): Promise<{ user: User; posts: Post[]; cursor: string | null }>;
  uploadMedia(file: PickedFile): Promise<Media>;
  createPost(input: { mediaIds: string[]; caption: string; alt?: Record<string, string> }): Promise<Post>;
  listInvites(): Promise<{ invites: Invite[]; limit: number }>;
  createInvite(maxUses?: number): Promise<{ code: string; url: string }>;
  report(input: { postId: string; url: string; note: string }): Promise<void>;
  follow(handle: string): Promise<User>;
  unfollow(handle: string): Promise<User>;
  followers(handle: string, cursor?: string | null): Promise<UserPage>;
  following(handle: string, cursor?: string | null): Promise<UserPage>;
  block(handle: string): Promise<User>;
  unblock(handle: string): Promise<User>;
  mute(handle: string): Promise<User>;
  unmute(handle: string): Promise<User>;
  blocks(cursor?: string | null): Promise<UserPage>;
  mutes(cursor?: string | null): Promise<UserPage>;
  like(postId: string): Promise<{ liked: boolean; likeCount: number }>;
  unlike(postId: string): Promise<{ liked: boolean; likeCount: number }>;
  comments(postId: string, cursor?: string | null): Promise<{ comments: Comment[]; cursor: string | null; total: number }>;
  addComment(input: { postId: string; body: string; parentId?: string }): Promise<Comment>;
  deleteComment(id: string): Promise<void>;
  notifications(cursor?: string | null): Promise<{ notifications: Notification[]; cursor: string | null; unread: number }>;
  unreadCount(): Promise<number>;
  markNotificationsRead(ids?: string[]): Promise<number>;
  search(q: string, kind: SearchKind, cursor?: string | null): Promise<{ users: User[]; posts: Post[]; cursor: string | null }>;
  updateProfile(input: { displayName?: string; bio?: string; links?: string[]; avatarMediaId?: string | null }): Promise<User>;
  fund(): Promise<FundCards | null>;
  flag(input: { targetType: "post" | "user"; targetId: string; reason: FlagReason; note: string }): Promise<void>;
  channels(): Promise<Channel[]>;
  roomMessages(room: ChatRoomRef, page?: { after?: string | null; before?: string | null }): Promise<ChatPage>;
  sendMessage(room: ChatRoomRef, body: string): Promise<ChatMessage>;
  deleteMessage(room: ChatRoomRef, messageId: string): Promise<void>;
  markRoomRead(room: ChatRoomRef): Promise<void>;
  flagMessage(input: { kind: "channel" | "dm"; messageId: string; reason: FlagReason; note: string }): Promise<void>;
  threads(box: "inbox" | "requests"): Promise<DmThread[]>;
  startThread(handle: string, body: string): Promise<{ thread: DmThread; message: ChatMessage }>;
  acceptThread(id: string): Promise<DmThread>;
  hideThread(id: string): Promise<void>;
  dmUnread(): Promise<{ inbox: number; requests: number }>;
  importPreview(from: string): Promise<{ label: string; items: ImportItem[] }>;
  connectors(): Promise<{ connectors: ImportConnector[]; locked: { name: string; why: string }[] }>;
  importPosts(input: { from: string; limit?: number; only?: string[]; autoPost?: boolean; rules?: ImportRules }): Promise<{ imported: number; skipped: { item: string; why: string }[] }>;
  sources(): Promise<ImportSource[]>;
  setSource(from: string, autoPost: boolean, rules?: ImportRules): Promise<ImportSource>;
  removeSource(id: string): Promise<void>;
}

export type ImportItem = { id: string; url: string; date: string | null; caption: string; photos: number; videos: number; thumb: string | null; onEmera: string | null };
export type ImportConnector = { id: string; name: string; example: string };
export type ImportRules = { media: "any" | "photos" | "videos"; tag?: string };
export type ImportSource = { id: string; from: string; kind: string; label: string; autoPost: boolean; rules: ImportRules; since: string; lastChecked: string | null; lastError: string | null };
