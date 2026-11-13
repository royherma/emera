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

export type PickedFile = { uri: string; mimeType: string; fileSize: number; width: number; height: number; kind: "image" | "video"; seconds?: number };

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
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
  flag(input: { targetType: "post" | "user"; targetId: string; reason: FlagReason; note: string }): Promise<void>;
  fund(): Promise<Fund>;
  fundMonth(month: string): Promise<FundStatement>;
  earnings(): Promise<Earnings>;
  watch(postId: string, seconds: number): Promise<number>;
}

export type FundRules = { version: string; creatorShare: number; photoCapS: number; videoCapS: number; creatorCapS: number; minViewerAgeH: number; heartbeatMaxS: number; payoutMinCents: number; closeDay: number };

export type FundMonth = {
  month: string;
  status: "open" | "closed";
  sponsoredCents: number;
  carryInCents: number;
  creatorPoolCents: number;
  emeraCents: number;
  totalSeconds: number;
  creators: number;
  sponsors: number;
  closedAt: string | null;
  sha256: string | null;
};

export type Sponsor = { name: string; url: string | null; amountCents: number };

export type Sponsorship = { id: string; sponsorName: string; sponsorUrl: string | null; month: string; amountCents: number; status: "pledged" | "paid" | "refunded"; createdAt: string };

export type FundShare = { handle: string | null; seconds: number; sharePpm: number; amountCents: number };

export type FundStatement = FundMonth & { rulesVersion: string; sponsorships: Sponsorship[]; shares: FundShare[]; carryOutCents: number };

export type Fund = { rules: FundRules; month: FundMonth; sponsors: Sponsor[]; history: FundMonth[] };

export type Earnings = {
  rules: FundRules;
  thisMonth: { month: string; seconds: number; totalSeconds: number; sharePpm: number; estimateCents: number };
  months: { month: string; seconds: number; sharePpm: number; amountCents: number }[];
  balanceCents: number;
  topPosts: { post: Post; seconds: number }[];
};
