const TEST_DOMAIN = /@(emera\.social|techguyverlabs\.org|resend\.dev|example\.(com|org|net)|test\.[a-z]+)$/i;
const TEST_LOCAL = /^(notify-test|e2e|qa|test|smoke|delivered\+)[\w.+-]*@/i;

export function ownEmails(env) {
  return new Set(String(env.OWN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export function isTest(env, email, flagged = false) {
  if (flagged) return true;
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  return TEST_DOMAIN.test(e) || TEST_LOCAL.test(e) || ownEmails(env).has(e);
}

export const flag = (cc) => (cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "");

export function place(r) {
  const where = [r.city, r.region && r.region !== r.city ? r.region : null, r.country].filter(Boolean).join(", ");
  return where ? `${where} ${flag(r.country)}`.trim() : null;
}

export function device(ua) {
  ua = String(ua || "");
  if (!ua) return null;
  let m;
  const kind = /iPhone|Android.*Mobile|iPod/.test(ua) ? "📱 phone" : /iPad|Android(?!.*Mobile)/.test(ua) ? "📱 tablet" : "💻 desktop";
  const os = (m = ua.match(/(iPhone|iPad|iPod).*? OS (\d+)[_.](\d+)/)) ? `${m[1]} iOS ${m[2]}.${m[3]}`
    : (m = ua.match(/Android (\d+(?:\.\d+)?)/)) ? `Android ${m[1]}`
    : /Windows NT 10/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : null;
  const browser = (m = ua.match(/(Instagram|FBAV|LinkedInApp|musical_ly|BytedanceWebview)/)) ? `${{ FBAV: "Facebook", musical_ly: "TikTok", BytedanceWebview: "TikTok", LinkedInApp: "LinkedIn" }[m[1]] || m[1]} in-app`
    : (m = ua.match(/Edg(?:A|iOS)?\/(\d+)/)) ? `Edge ${m[1]}` : (m = ua.match(/(?:Firefox|FxiOS)\/(\d+)/)) ? `Firefox ${m[1]}`
    : (m = ua.match(/(?:Chrome|CriOS)\/(\d+)/)) ? `Chrome ${m[1]}` : (m = ua.match(/Version\/(\d+(?:\.\d+)?).*Safari/)) ? `Safari ${m[1]}` : null;
  return [kind, os, browser].filter(Boolean).join(" · ");
}

const SOURCES = [
  [/instagram|^ig$/i, "📸 Instagram"], [/facebook|^fb$|FBAV/i, "📘 Facebook"], [/tiktok|musical_ly|Bytedance/i, "🎵 TikTok"],
  [/youtube|youtu\.be/i, "▶️ YouTube"], [/^(x|twitter)$|twitter\.com|\/\/x\.com|t\.co\//i, "🐦 X"], [/linkedin|lnkd/i, "💼 LinkedIn"],
  [/reddit/i, "👽 Reddit"], [/threads\.net/i, "🧵 Threads"], [/bsky|bluesky/i, "🦋 Bluesky"], [/github/i, "🐙 GitHub"],
  [/news\.ycombinator/i, "🟧 Hacker News"], [/chatgpt|openai/i, "🤖 ChatGPT"], [/perplexity/i, "🤖 Perplexity"], [/claude\.ai|anthropic/i, "🤖 Claude"],
  [/gemini/i, "🤖 Gemini"], [/google/i, "🔍 Google"], [/bing|duckduckgo|yahoo|ecosia|brave/i, "🔍 Search"], [/mail|resend|newsletter/i, "✉️ Email"],
];

export function source(r) {
  const utm = String(r.utm || "");
  const ref = String(r.referrer || "");
  const ua = String(r.ua || "");
  const utmSrc = utm.match(/(?:utm_source|ref)=([^&]+)/)?.[1];
  for (const probe of [utmSrc, ref, /Instagram|FBAV|musical_ly|Bytedance|LinkedInApp/.test(ua) ? ua : null]) {
    if (!probe) continue;
    const hit = SOURCES.find(([re]) => re.test(probe));
    if (hit) return hit[1];
  }
  if (ref) {
    try { return `🌐 ${new URL(ref).hostname.replace(/^www\./, "")}`; } catch { return `🌐 ${ref.slice(0, 60)}`; }
  }
  return utmSrc ? `🏷️ ${utmSrc}` : "⌨️ Direct";
}

export function bangkok(ms, withDate = false) {
  const o = { timeZone: "Asia/Bangkok", hour: "numeric", minute: "2-digit" };
  if (withDate) Object.assign(o, { day: "numeric", month: "short" });
  return `${new Date(ms).toLocaleString("en-US", o)} Bangkok`;
}

export function theirTime(tz) {
  if (!tz) return null;
  try {
    return `${new Date().toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" })} their time`;
  } catch {
    return null;
  }
}

export const toMs = (v) => (typeof v === "number" ? v : Date.parse(v));
