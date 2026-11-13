export type User = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  createdAt: string;
  category?: string;
};

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
  feed(cursor?: string | null): Promise<{ posts: Post[]; cursor: string | null }>;
  post(id: string): Promise<Post>;
  deletePost(id: string): Promise<void>;
  profile(handle: string, cursor?: string | null): Promise<{ user: User; posts: Post[]; cursor: string | null }>;
  uploadMedia(file: PickedFile): Promise<Media>;
  createPost(input: { mediaIds: string[]; caption: string }): Promise<Post>;
  createInvite(): Promise<{ code: string; url: string }>;
  report(input: { postId: string; url: string; note: string }): Promise<void>;
  like(postId: string): Promise<{ liked: boolean; likeCount: number }>;
  unlike(postId: string): Promise<{ liked: boolean; likeCount: number }>;
  comments(postId: string, cursor?: string | null): Promise<{ comments: Comment[]; cursor: string | null; total: number }>;
  addComment(input: { postId: string; body: string; parentId?: string }): Promise<Comment>;
  deleteComment(id: string): Promise<void>;
  notifications(cursor?: string | null): Promise<{ notifications: Notification[]; cursor: string | null; unread: number }>;
  unreadCount(): Promise<number>;
  markNotificationsRead(ids?: string[]): Promise<number>;
}
