export type Env = {
  DB: D1Database;
  MEDIA: R2Bucket;
  IMAGES?: ImagesBinding;
  VIDEO?: MediaBinding;
  AI?: { run(model: string, input: Record<string, unknown>): Promise<unknown> };
  VIDEO_JOBS?: Queue<{ mediaId: string; shrink?: boolean }>;
  ENVIRONMENT: string;
  INVITES_REQUIRED: string;
  SEED_INVITE_CODE: string;
  PROOF_SECRET: string;
  CHAT_KEY?: string;
  CHAT_LIVE: DurableObjectNamespace<import('./live').ChatLive>;
  PUBLIC_ORIGIN: string;
  SENTRY_DSN?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  REPORTS_TO?: string;
  FUNDING?: string;
  FUND_ADMIN_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_ACCOUNT_ID?: string;
  STRIPE_SPONSOR_PRODUCT?: string;
  FUND_PAGE_URL?: string;
  SIGNIN_LIMIT?: RateLimit;
  WRITE_LIMIT?: RateLimit;
  POSTS_PER_DAY?: string;
  UPLOADS_PER_DAY?: string;
  SIGNIN_EMAILS_PER_DAY?: string;
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
  role?: Role | null;
};

export type Role = 'admin' | 'mod' | 'creator';

export type Vars = { user: UserRow };
export type AppEnv = { Bindings: Env; Variables: Vars };
