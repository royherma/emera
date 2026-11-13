export const RULES_VERSION = '1.1.0';
export const CREATOR_SHARE = 0.5;
export const PHOTO_CAP_S = 60;
export const VIDEO_CAP_S = 600;
export const CREATOR_CAP_S = 1800;
export const MIN_VIEWER_AGE_H = 24;
export const HEARTBEAT_MAX_S = 30;
export const PAYOUT_MIN_CENTS = 1000;
export const CLOSE_DAY = 3;
export const FEED_CARD_MIN_POSTS = 1000;
export const FEED_CARD_EVERY = 12;
export const MIN_MONTHLY_CENTS = 1000;
export const MAX_CHECKOUT_MONTHS = 12;

export const rulesJson = () => ({
  version: RULES_VERSION,
  creatorShare: CREATOR_SHARE,
  photoCapS: PHOTO_CAP_S,
  videoCapS: VIDEO_CAP_S,
  creatorCapS: CREATOR_CAP_S,
  minViewerAgeH: MIN_VIEWER_AGE_H,
  heartbeatMaxS: HEARTBEAT_MAX_S,
  payoutMinCents: PAYOUT_MIN_CENTS,
  closeDay: CLOSE_DAY,
  feedCardMinPosts: FEED_CARD_MIN_POSTS,
  feedCardEvery: FEED_CARD_EVERY,
  minMonthlyCents: MIN_MONTHLY_CENTS,
  maxCheckoutMonths: MAX_CHECKOUT_MONTHS,
});
