export type Env = {
  DB: D1Database;
  MEDIA: R2Bucket;
  IMAGES?: ImagesBinding;
  VIDEO?: MediaBinding;
  VIDEO_JOBS?: Queue<{ mediaId: string; shrink?: boolean }>;
  ENVIRONMENT: string;
  INVITES_REQUIRED: string;
  SEED_INVITE_CODE: string;
  PROOF_SECRET: string;
  PUBLIC_ORIGIN: string;
  SENTRY_DSN?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  REPORTS_TO?: string;
};

export type UserRow = {
  id: string;
  email: string;
  handle: string | null;
  display_name: string;
  bio: string;
  links: string;
  avatar_url: string | null;
  invited_by: string | null;
  created_at: number;
};

export type Vars = { user: UserRow };
export type AppEnv = { Bindings: Env; Variables: Vars };
