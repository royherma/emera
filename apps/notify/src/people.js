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

export function screenOf(r) {
  try {
    const o = typeof r?.screen === "string" ? JSON.parse(r.screen) : r?.screen;
    return o && typeof o === "object" ? o : null;
  } catch {
    return null;
  }
}

export function device(ua, sc = {}) {
  ua = String(ua || "");
  if (!ua) return null;
  sc = sc || {};
  let m;
  const major = Number(String(sc.pv || "").split(".")[0]) || 0;
  const pv = String(sc.pv || "").split(".").slice(0, 2).join(".");
  const kind = /iPhone|Android.*Mobile|iPod/.test(ua) ? "📱 phone" : /iPad|Android(?!.*Mobile)/.test(ua) || (/Mac OS X/.test(ua) && sc.touch) ? "📱 tablet" : "💻 desktop";
  const os = (m = ua.match(/(iPhone|iPad|iPod).*? OS (\d+)[_.](\d+)/)) ? `${m[1]} iOS ${m[2]}.${m[3]}`
    : (m = ua.match(/Android (\d+(?:\.\d+)?)/)) ? `Android ${m[1]}`
    : /Windows NT 10/.test(ua) ? (major ? `Windows ${major >= 13 ? 11 : 10}` : "Windows")
    : /Mac OS X/.test(ua) ? (sc.touch ? "iPad" : pv ? `macOS ${pv}` : "Mac")
    : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : null;
  const browser = (m = ua.match(/(Instagram|FBAV|LinkedInApp|musical_ly|BytedanceWebview)/)) ? `${{ FBAV: "Facebook", musical_ly: "TikTok", BytedanceWebview: "TikTok", LinkedInApp: "LinkedIn" }[m[1]] || m[1]} in-app`
    : (m = ua.match(/Edg(?:A|iOS)?\/(\d+)/)) ? `Edge ${m[1]}` : (m = ua.match(/OPR\/(\d+)/)) ? `Opera ${m[1]}` : (m = ua.match(/(?:Firefox|FxiOS)\/(\d+)/)) ? `Firefox ${m[1]}`
    : (m = ua.match(/SamsungBrowser\/(\d+)/)) ? `Samsung Internet ${m[1]}`
    : (m = ua.match(/(?:Chrome|CriOS)\/(\d+)/)) ? `Chrome ${m[1]}` : (m = ua.match(/Version\/(\d+(?:\.\d+)?).*Safari/)) ? `Safari ${m[1]}` : null;
  return [kind, sc.model, os, browser].filter(Boolean).join(" · ");
}

export function screenLine(sc) {
  if (!sc?.sw || !sc?.sh) return null;
  const hw = [sc.mem && `${sc.mem} GB memory`, sc.cores && `${sc.cores} cores`].filter(Boolean).join(", ");
  return [
    `${sc.sw}×${sc.sh}${sc.dpr ? ` @${sc.dpr}x` : ""}`,
    sc.vw && sc.vh && `window ${sc.vw}×${sc.vh}`,
    sc.dark ? "dark mode" : sc.dark === false ? "light mode" : null,
    sc.touch ? "touch" : sc.touch === false ? "mouse" : null,
    hw || null,
  ].filter(Boolean).join(" · ");
}

const CARRIER = /mobile|wireless|cellular|mobility|true move|dtac|telkomsel|jio|airtel|vodafone|t-mobile|telcel|claro|movistar|viettel|singtel|starhub|m1 limited/i;

export function connection(sc, network) {
  sc = sc || {};
  const kind = sc.type === "cellular" ? "cellular" : sc.type && sc.type !== "other" ? sc.type.replace("wifi", "Wi-Fi") : network && CARRIER.test(network) ? "cellular (carrier network)" : null;
  const speed = sc.speed && `${sc.speed === "4g" ? "fast" : sc.speed === "3g" ? "medium" : "slow"} speed`;
  return [kind, speed, sc.mbps && `~${sc.mbps} Mbps`, sc.rtt && `${sc.rtt} ms ping`, sc.save && "data saver on"].filter(Boolean).join(" · ") || null;
}

export function clockLine(r, sc) {
  const tz = sc?.tz || r.timezone;
  const t = theirTime(tz);
  if (!t) return null;
  const vpn = sc?.tz && r.timezone && sc.tz !== r.timezone ? `  ·  network says ${r.timezone} (VPN or travelling)` : "";
  return `${t.replace(" their time", "")} · ${tz}${vpn}`;
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
  const ref = /^https?:\/\/([\w-]+\.)*emera\.social(\/|$)/i.test(String(r.referrer || "")) ? "" : String(r.referrer || "");
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

const HOSTING = /amazon|aws|google llc|google cloud|microsoft|digitalocean|hetzner|ovh|linode|akamai|vultr|oracle|alibaba|tencent|contabo|leaseweb|scaleway|choopa|m247|datacamp|censys|shodan|palo alto|virtual systems|hosting|host|datacenter|data center|data ?cent|colo|vps|vpn|proxy|server|cloud|packet|driftnet|azure|hostinger/i;
const currentChrome = () => 120 + Math.floor((Date.now() - Date.UTC(2023, 11, 5)) / (28 * 86_400_000));

export const networkKind = (network) => (network && HOSTING.test(network) ? "hosting" : "residential");

export function isBotVisit(r) {
  if (r.bot) return true;
  const sc = screenOf(r);
  if (sc?.sw && sc?.sh && ((sc.sw === 800 && sc.sh === 600) || (sc.sw === 1024 && sc.sh === 1024))) return true;
  if (sc?.sw && sc?.vw && sc.vw > sc.sw * 1.05) return true;
  if (r.network && HOSTING.test(r.network)) return true;
  const chrome = Number(String(r.ua || "").match(/Chrome\/(\d+)/)?.[1]);
  const firefox = Number(String(r.ua || "").match(/Firefox\/(\d+)/)?.[1]);
  return (!!chrome && chrome < currentChrome() - 20) || (!!firefox && firefox < currentChrome() - 30);
}
