export type User = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
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
  sha256: string;
  proof: Proof;
};

export type Post = { id: string; author: User; caption: string; media: Media[]; createdAt: string; url: string };

export type Invite = {
  code: string;
  url: string;
  uses: number;
  maxUses: number;
  createdAt: string;
  joined: { handle: string; displayName: string }[];
};

export type PickedFile = { uri: string; mimeType: string; fileSize: number; width: number; height: number; kind: "image" | "video" };

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
  createPost(input: { mediaIds: string[]; caption: string }): Promise<Post>;
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
}
