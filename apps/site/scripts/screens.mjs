import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const I = (n, c = "") => `<svg class="ic ${c}" viewBox="0 0 24 24"><use href="#i-${n}"/></svg>`;
const img = (f) => `<img src="/assets/work/${f}.jpg" alt="">`;
const av = (f, s = 34, c1 = "#ff9a3c", c2 = "#ff4f8b") =>
  `<span class="av" style="--s:${s}px;--c1:${c1};--c2:${c2}"><i>${img(f)}</i></span>`;
const ver = `<span class="vh">${I("check")}</span>`;
const signed = `<span class="gl pmk">${I("shield")}Signed</span>`;
const credit = (t) => `<span class="gl cr">${t}</span>`;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const litSvg = readFileSync(join(root, "../../brand/logo/final/mark-lit-symbol.svg"), "utf8");
const litBox = litSvg.match(/viewBox="([^"]+)"/)[1];
const litInner = litSvg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
export const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc24a"/><stop offset="1" stop-color="#ff6a2b"/></linearGradient>
<symbol id="i-home" viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/></symbol>
<symbol id="i-compass" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2 5.2-5.2 2 2-5.2z"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
<symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></symbol>
<symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 20s-7.5-4.5-7.5-10.2A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.2C19.5 15.5 12 20 12 20z"/></symbol>
<symbol id="i-chat" viewBox="0 0 24 24"><path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8.5L6 20v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></symbol>
<symbol id="i-repeat" viewBox="0 0 24 24"><path d="M17 4l3 3-3 3M20 7H8.5A4.5 4.5 0 0 0 4 11.5M7 20l-3-3 3-3M4 17h11.5a4.5 4.5 0 0 0 4.5-4.5"/></symbol>
<symbol id="i-share" viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></symbol>
<symbol id="i-bookmark" viewBox="0 0 24 24"><path d="M7 4h10v16l-5-4-5 4z"/></symbol>
<symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l7 2.6v5.7c0 4.3-3 7.4-7 9.7-4-2.3-7-5.4-7-9.7V5.6z"/><path d="M8.8 12l2.4 2.4 4.1-4.5"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M5.5 12.5l4.2 4.2L18.5 8"/></symbol>
<symbol id="i-grid" viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></symbol>
<symbol id="i-back" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></symbol>
<symbol id="i-dots" viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/></symbol>
<symbol id="i-flag" viewBox="0 0 24 24"><path d="M5.5 21V4M5.5 4.5h11l-2.2 3.8 2.2 3.8h-11"/></symbol>
<symbol id="i-send" viewBox="0 0 24 24"><path d="M5 12l14-7-5 14-2.5-5.5z"/></symbol>
<symbol id="i-sun" viewBox="0 0 24 24"><path d="M5 15a7 7 0 0 1 14 0M3 15h18M12 3v2.5M4.6 7.6l1.7 1.7M19.4 7.6l-1.7 1.7"/></symbol>
<symbol id="i-moon" viewBox="0 0 24 24"><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5 7.5 7.5 0 1 0 19 14.5z"/></symbol>
<symbol id="i-sliders" viewBox="0 0 24 24"><path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/></symbol>
<symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></symbol>
<symbol id="i-person" viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.6-4 3.6-6 7-6s6.4 2 7 6"/></symbol>
<symbol id="i-key" viewBox="0 0 24 24"><circle cx="8" cy="14" r="4"/><path d="M11 11l8-8M16 6l3 3"/></symbol>
<symbol id="i-volume" viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></symbol>
<symbol id="i-note" viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></symbol>
<symbol id="i-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2.5"/><path d="M5 15V7a2 2 0 0 1 2-2h8"/></symbol>
<symbol id="mark" viewBox="${litBox}">${litInner}</symbol>
</defs></svg>`;

const sb = `<div class="sb"><b>9:41</b><span><svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2" width="3" height="10" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".5"/><rect x="2" y="2" width="16" height="8" rx="2"/></svg></span></div>`;

const tabs = (on, face) => `<nav class="tabs"><a class="${on === "home" ? "on" : ""}">${I("home")}</a><a class="${on === "compass" ? "on" : ""}">${I("compass")}</a><a class="plus"><span>${I("plus")}</span></a><a>${I("bell")}<em></em></a><a>${av(face, 28, "#ff9a3c", "#ffc24a")}</a></nav>`;

const acts = (a, b, c, tag, col) =>
  `<div class="acts sm"><span>${I("heart")}${a}</span><span>${I("chat")}${b}</span><span>${I("repeat")}${c}</span><span class="chip" style="--c:${col}"><s></s>${tag}</span></div>`;

const ipost = ({ face, name, handle, ago, f, h, cr, kind = "photo", n = 4, len = "0:24", text, likes, comments, reposts, tag, col, c1 = "#ff9a3c", c2 = "#ff4f8b" }) => {
  const over = kind === "carousel" ? `<span class="gl cnt">1/${n}</span>` : kind === "video" ? `<span class="gl vt">${I("volume")}${len}</span><span class="vbar"><i></i></span>` : "";
  const dots = kind === "carousel" ? `<div class="dots">${Array.from({ length: n }, (_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : "";
  return `<div class="ip"><div class="ph2">${av(face, 32, c1, c2)}<div class="who"><b>${name}</b>${ver}<span class="tm">${ago}</span></div><span class="dt">${I("dots")}</span></div>
<div class="m" style="height:${h}px">${img(f)}${signed}${credit(cr)}${over}</div>${dots}
<div class="acts sm"><span>${I("heart")}${likes}</span><span>${I("chat")}${comments}</span><span>${I("repeat")}${reposts}</span><span class="chip" style="--c:${col}"><s></s>${tag}</span></div>
<p class="cap"><b>${handle}</b>${text}</p></div>`;
};

const sponsorLine = ({ name, line }) => `<div class="spl"><span>SPONSOR</span><p><b data-sp-name>${name}</b><i data-sp-line>${line}</i></p></div>`;

const feed = (th, sponsor) => `<div class="scr ${th}">${sb}
<div class="top"><div class="lg"><svg viewBox="0 0 100 100"><use href="#mark"/></svg>emera</div><div class="tr">${I("search")}${I("bell")}</div></div>
${sponsor ? sponsorLine(sponsor) + "\n" : ""}<div class="seg"><a class="on">Following</a><a>Open feeds</a><a>Newest</a></div>
${ipost({ face: "lanterns", name: "Mei Lin", handle: "meilin.reports", ago: "9m", f: "lanterns", h: 292, cr: "Photo: Visible Hand, CC BY", kind: "carousel", n: 4, text: "Labyrinth of Light tonight. The whole square is candles.", likes: "3.4k", comments: "412", reposts: "889", tag: "Events", col: "#3dc6c0", c1: "#3dbcf0", c2: "#8a7bff" })}
${ipost({ face: "reddance", name: "Ama Dance Co", handle: "ama.dance", ago: "21m", f: "reddance", h: 292, cr: "Still: Steven Pisano, CC BY", kind: "video", len: "0:24", text: "Opening night, one take from the wings.", likes: "8.1k", comments: "530", reposts: "1.2k", tag: "Dance", col: "#ff6a5b" })}
${tabs("home", "yarn")}</div>`;

const watch = ({ f, face, name, handle, text, cr, sound, likes, comments, reposts, prog = 44 }) => () => `<div class="scr night wt"><div class="bg">${img(f)}</div>${sb}
<div class="wtop"><a class="on">Following</a><a>Open feeds</a></div>
<div class="rail"><span class="rav">${av(face, 44, "#ff9a3c", "#ffc24a")}<b class="pl">${I("plus")}</b></span><span>${I("heart")}${likes}</span><span>${I("chat")}${comments}</span><span>${I("repeat")}${reposts}</span><span>${I("share")}Share</span></div>
<div class="winfo"><div class="who"><b>${name}</b>${ver}<span class="hd">@${handle}</span></div><p>${text}</p><span class="gl st">${I("shield")}Signed by a verified human</span><div class="snd">${I("note")}${sound}</div><small class="wcr">${cr}</small></div>
<div class="wbar"><i style="width:${prog}%"></i></div>
${tabs("compass", "yarn")}</div>`;

const swatches = ["#ffd21f", "#f2634a", "#d8201f", "#9b6bff", "#3b6ea5", "#2c9a6b", "#e0a263", "#8b5a3c", "#e8a89a", "#ffd21f"];
const tile = (f, h, n, c) => `<div class="t" style="height:${h}px">${img(f)}<span class="ct">${I("heart")}${n}</span><span class="pm" style="--c:${c}">${I("shield")}</span></div>`;

const explore = (th) => `<div class="scr ${th}">${sb}
<div class="top solo"><span class="h1">Explore</span></div>
<div class="search">${I("search")}<span>Search makers, works, mediums</span><i>${I("sliders")}</i></div>
<div class="chips"><a class="on"><s style="--c:#ff8a2b"></s>All</a><a><s style="--c:#ff6a5b"></s>Illustration</a><a><s style="--c:#8a7bff"></s>Film</a><a><s style="--c:#ffc24a"></s>Music</a><a><s style="--c:#3dc6c0"></s>News</a></div>
<div class="sec"><b>Colors of today</b><span>From works signed since dawn</span></div>
<div class="swr">${swatches.map((c) => `<i style="background:${c}"></i>`).join("")}</div>
<div class="mas"><div>${tile("reddance", 128, "2.3k", "#ff6a5b")}${tile("ceramics", 94, "4.6k", "#ffc24a")}${tile("lettering", 104, "4.8k", "#ff8a2b")}</div><div>${tile("kimono", 232, "4.4k", "#ff6a5b")}${tile("swirl3d", 70, "3.4k", "#8a7bff")}${tile("balletfeet", 80, "2.9k", "#ff8a2b")}</div></div>
${tabs("compass", "yarn")}</div>`;

const profile = (th) => `<div class="scr ${th}">${sb}
<div class="top pf"><span class="lg2">${I("back")}</span><span class="hnd">wrenfiber.emera.social</span><span>${I("dots")}</span></div>
<div class="phead"><div class="pr1">${av("yarn", 82, "#ff9a3c", "#ffc24a")}<div class="stats"><div><b>148</b><small>Works</small></div><div><b>12.4k</b><small>Followers</small></div><div><b>312</b><small>Following</small></div></div></div>
<div class="pn"><b>Wren Fiber Co</b>${ver}<span class="gl3">Verified human</span></div>
<p class="bio">Hand-dyed yarn and slow knitting. Every piece is signed by me.</p>
<div class="pa"><a class="fol">Follow</a><a class="msg">Message</a><a class="shr">${I("share")}</a></div></div>
<div class="ptabs"><a class="on">${I("grid")}Works</a><a>${I("shield")}Signed</a></div>
<div class="g3" style="--gg:3px;--gp:0px"><div class="t">${img("yarn")}</div><div class="t">${img("watercolor")}</div><div class="t">${img("lettering")}</div><div class="t">${img("kimono")}</div><div class="t">${img("ceramics")}</div><div class="t">${img("ramen")}</div><div class="t">${img("mural")}</div><div class="t">${img("records")}</div><div class="t">${img("stairs")}</div></div>
${tabs("", "yarn")}</div>`;

const post = (th) => `<div class="scr ${th}">${sb}
<div class="top pf"><span>${I("back")}</span><span class="hnd">Post</span><span>${I("dots")}</span></div>
<div class="post"><div class="row">${av("lettering", 38, "#ff9a3c", "#ffc24a")}<div class="who2"><div class="who"><b>Nour Letters</b>${ver}</div><span class="hd">@nour.letters.emera.social</span></div><a class="fol sm">Follow</a></div>
<div class="media big">${img("lettering")}${signed}</div></div>
<div class="acts" style="padding:9px 18px 2px"><span>${I("heart")}1.2k</span><span>${I("chat")}144</span><span>${I("repeat")}97</span><span class="sv">${I("bookmark")}</span></div>
<div class="pt"><b>Burn the boats, in brush and ink</b><p>28 letters, drawn in one sitting.</p></div>
<div class="proof"><span class="seal">${I("shield")}</span><div><b>Made by Nour Letters, a verified human</b><span>Signed 13 Nov 2026, original</span><small>Photo: SevenSeventyFive, CC BY</small></div></div>
<div class="why">${I("eye")}Seen because you follow Sabine Aquarelle, who reposted it</div>
<div class="reps"><div class="rp">${av("mural", 26)}<div><div class="who"><b>Kofi Walls</b>${ver}<span class="tm">8m</span></div><p>Those serifs breathe. Is this one pass or two?</p></div></div></div>
<div class="comp"><span class="rpl">Reply to Nour</span><i>${I("send")}</i></div></div>`;

export const screenCss = `.ph{width:calc(390px*var(--k) + 12px);height:calc(800px*var(--k) + 12px);padding:6px;border-radius:calc(54px*var(--k) + 8px);flex:none}
.ph.day{background:#fffdf8;box-shadow:0 34px 60px -26px rgba(120,60,10,.5),0 0 0 1px rgba(90,50,10,.12)}
.ph.night{background:linear-gradient(160deg,#2c2520,#0e0b09);box-shadow:0 34px 60px -22px rgba(0,0,0,.9),0 0 0 1px rgba(255,235,210,.14) inset}
.sw{width:100%;height:100%;border-radius:calc(48px*var(--k) + 4px);overflow:hidden;position:relative}
.scr{width:390px;height:800px;transform:scale(var(--k));transform-origin:0 0;position:relative;display:flex;flex-direction:column;background:var(--bg);color:var(--tx);font:400 13.5px/1.35 var(--body);overflow:hidden;text-align:left}
.scr.day{--bg:#fbf5ea;--s1:#fffaf1;--s2:#f1e8d8;--hair:rgba(60,35,10,.1);--tx:#2a1d14;--tx2:#6b5846;--tx3:#9a8672;--sunink:#9a4a00}
.scr.night{--bg:#0c0a09;--s1:#1a1613;--s2:#221d19;--hair:rgba(255,235,210,.09);--tx:#fbf3e8;--tx2:#bcae9d;--tx3:#8a7c6d;--sunink:#ffc98a}
.scr img{display:block;width:100%;height:100%;object-fit:cover}
.scr .ic{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}
.sb{display:flex;justify-content:space-between;align-items:center;padding:14px 30px 0;height:44px;font:600 15px var(--body);flex:none}
.sb span{display:flex;gap:6px;align-items:center}.sb svg{height:11px;fill:currentColor}
.top{display:flex;justify-content:space-between;align-items:center;padding:6px 18px 4px;height:44px;flex:none}
.top .lg{display:flex;align-items:center;gap:8px;font:600 22px/1 var(--disp);letter-spacing:-.05em}
.top .lg svg{width:28px;height:28px;color:var(--tx);--bg:var(--bg)}
.top .tr{display:flex;gap:16px}
.top .h1{font:700 26px/1 var(--disp);letter-spacing:-.03em;margin:0}
.top.pf .hnd{font:600 14px var(--body)}
.seg{display:flex;gap:6px;padding:4px 16px 0;height:42px;flex:none;font:600 13.5px var(--body);color:var(--tx3)}
.seg a{padding:0 14px;height:32px;border-radius:99px;display:grid;place-items:center;background:var(--s2)}
.seg .on{background:var(--tx);color:var(--bg)}
.av{width:var(--s);height:var(--s);border-radius:50%;padding:2.2px;background:conic-gradient(from 210deg,var(--c1),var(--c2),var(--c1));flex:none;display:block}
.av i{display:block;width:100%;height:100%;border-radius:50%;border:2px solid var(--bg);overflow:hidden;background:var(--s1)}
.vh{display:inline-grid;place-items:center;width:13px;height:13px;border-radius:50%;background:var(--sun);color:#1a1008;flex:none}
.vh .ic{width:9px;height:9px;stroke-width:3}
.who{display:flex;align-items:center;gap:5px;min-width:0;white-space:nowrap}
.who b{font:600 13.5px var(--body)}
.who .hd,.who .tm,.tm{color:var(--tx3);font-size:12px}
.gl{position:absolute;display:inline-flex;align-items:center;gap:5px;color:#fff;background:rgba(14,10,8,.42);backdrop-filter:blur(14px) saturate(1.6);border:1px solid rgba(255,255,255,.2);border-radius:99px;font:600 11px var(--body);padding:4px 10px 4px 8px}
.gl .ic{width:13px;height:13px;stroke-width:2;color:var(--sun2)}
.gl.pmk{left:10px;top:10px}.gl.cr{left:10px;bottom:10px;font-weight:500;font-size:10px;padding:3px 9px}
.media{position:relative;overflow:hidden;border-radius:18px;box-shadow:0 14px 26px -16px rgba(0,0,0,.5)}
.bl{padding:0 12px;flex:none;display:flex;flex-direction:column}
.brow{display:flex;gap:10px;padding:10px 4px;border-bottom:1px solid var(--hair)}
.lcol{display:flex;flex-direction:column;align-items:center;gap:5px}.lcol u{flex:1;width:2px;border-radius:2px;background:var(--hair)}
.rcol{flex:1;min-width:0}.rcol p{font-size:13.5px;margin:2px 0 7px;line-height:1.38}
.acts{display:flex;gap:20px;align-items:center;padding:9px 4px 2px;color:var(--tx2);font:500 12.5px var(--body)}
.acts span{display:flex;align-items:center;gap:6px}.acts .ic{width:20px;height:20px}
.acts .sv{margin-left:auto}.acts.sm{padding-top:8px;gap:16px}.acts.sm .ic{width:17px;height:17px}
.chip{margin-left:auto;display:inline-flex;align-items:center;gap:5px;font:600 10.5px var(--body);color:var(--tx2)}
.chip s{width:6px;height:6px;border-radius:50%;background:var(--c);box-shadow:0 0 0 3px color-mix(in oklab,var(--c) 25%,transparent)}
.tabs{position:absolute;left:14px;right:14px;bottom:16px;height:60px;display:flex;justify-content:space-around;align-items:flex-start;padding:6px 4px 0;z-index:5;color:var(--tx3);border-radius:22px;background:var(--s1);box-shadow:0 12px 26px -10px rgba(40,20,0,.35),0 0 0 1px var(--hair)}
.night .tabs{background:#1f1a16;box-shadow:0 14px 30px -10px rgba(0,0,0,.8),0 0 0 1px var(--hair)}
.tabs a{width:56px;height:46px;display:grid;place-items:center;position:relative}
.tabs .ic{width:25px;height:25px}
.tabs .on{color:var(--tx)}.tabs .on:after{content:"";position:absolute;bottom:0;width:5px;height:5px;border-radius:50%;background:var(--sun)}
.tabs em{position:absolute;top:6px;right:15px;width:8px;height:8px;border-radius:50%;background:var(--sun);border:2px solid var(--s1);box-sizing:content-box}
.tabs .plus span{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,var(--sun2),var(--sun));display:grid;place-items:center;color:#1a1008;box-shadow:0 6px 16px -4px rgba(255,120,30,.55)}
.tabs .plus .ic{stroke-width:2.4}
.search{margin:4px 16px 8px;height:42px;border-radius:15px;background:var(--s2);display:flex;align-items:center;gap:10px;padding:0 6px 0 14px;color:var(--tx3);font:500 14px var(--body);flex:none}
.search span{flex:1}.search i{width:30px;height:30px;border-radius:10px;background:var(--s1);display:grid;place-items:center;color:var(--tx2)}.search i .ic{width:16px;height:16px}
.chips{display:flex;gap:7px;padding:0 16px 10px;flex:none;overflow:hidden}
.chips a{display:flex;align-items:center;gap:6px;height:30px;padding:0 12px 0 10px;border-radius:99px;background:var(--s2);font:600 12.5px var(--body);color:var(--tx2);white-space:nowrap}
.chips a s{width:8px;height:8px;border-radius:50%;background:var(--c)}
.chips a.on{background:var(--tx);color:var(--bg)}
.sec{display:flex;align-items:baseline;justify-content:space-between;padding:2px 18px 8px;flex:none}
.sec b{font:700 15px var(--disp);letter-spacing:-.02em}.sec span{font:500 11.5px var(--body);color:var(--tx3)}
.swr{display:flex;gap:5px;padding:0 14px 10px;flex:none}.swr i{flex:1;height:26px;border-radius:9px;display:block}
.mas{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 14px;align-items:start;flex:none}
.mas>div{display:flex;flex-direction:column;gap:8px}
.t{position:relative;border-radius:16px;overflow:hidden;background:var(--s1)}
.t .pm,.t .ct{position:absolute;display:grid;place-items:center;color:#fff;background:rgba(14,10,8,.42);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.2)}
.t .pm{right:6px;bottom:6px;width:20px;height:20px;border-radius:50%}.pm .ic{width:12px;height:12px;stroke-width:2;color:var(--c,#fff)}
.t .ct{left:6px;bottom:6px;display:flex;align-items:center;gap:3px;height:20px;padding:0 7px 0 5px;border-radius:99px;font:600 10.5px var(--body)}
.t .ct .ic{width:11px;height:11px;fill:#fff;stroke:#fff}
.phead{position:relative;padding:0 18px;flex:none}
.pr1{display:flex;align-items:center;gap:20px}
.stats{display:flex;flex:1;justify-content:space-between;text-align:center}
.stats b{display:block;font:700 18px var(--disp);letter-spacing:-.02em}.stats small{font:500 11.5px var(--body);color:var(--tx2)}
.pn{display:flex;align-items:center;gap:6px;margin-top:10px}.pn b{font:700 19px var(--disp);letter-spacing:-.03em}
.pn .vh{width:15px;height:15px}.pn .vh .ic{width:10px;height:10px}
.gl3{font:600 10.5px var(--body);padding:3px 9px;border-radius:99px;background:color-mix(in oklab,var(--sun) 20%,transparent);color:var(--sunink)}
.bio{margin-top:4px;font:400 13.5px/1.4 var(--body);max-width:330px}
.pa{display:flex;gap:8px;margin-top:11px;margin-bottom:12px}
.pa a,.fol{height:38px;border-radius:13px;display:grid;place-items:center;font:700 13.5px var(--body)}
.fol{background:linear-gradient(135deg,var(--sun2),var(--sun));color:#1a1008;box-shadow:0 6px 16px -6px rgba(255,120,30,.6)}.pa .fol{flex:1.3}
.pa .msg{flex:1;background:var(--s2)}.pa .shr{width:42px;background:var(--s2)}
.ptabs{display:flex;border-top:1px solid var(--hair);flex:none}
.ptabs a{flex:1;height:38px;display:flex;align-items:center;justify-content:center;gap:6px;color:var(--tx3);font:600 12.5px var(--body);position:relative}
.ptabs .ic{width:18px;height:18px}.ptabs .on{color:var(--tx)}.ptabs .on:after{content:"";position:absolute;bottom:0;left:22%;right:22%;height:2.5px;border-radius:2px;background:var(--sun)}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;flex:none}.g3 .t{aspect-ratio:1;border-radius:0}
.post{padding:6px 14px 0;flex:none}.post .row{display:flex;align-items:center;gap:10px;padding:0 2px 8px}
.who2{flex:1;display:flex;flex-direction:column}.who2 .hd{color:var(--tx3);font-size:12px}
.fol.sm{height:30px;padding:0 16px;border-radius:11px;font-size:12.5px}
.media.big{height:232px}
.ip{flex:none;border-bottom:1px solid var(--hair);padding-bottom:4px}
.ph2{display:flex;align-items:center;gap:9px;padding:8px 14px}.ph2 .dt{margin-left:auto;color:var(--tx3)}
.ip .m{position:relative;overflow:hidden}
.gl.cnt{right:10px;top:10px;padding:3px 9px;font-size:10.5px}
.gl.vt{right:10px;bottom:12px;padding:3px 9px 3px 7px;font-size:10.5px}
.vbar{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.28)}.vbar i{display:block;width:38%;height:100%;background:var(--sun2)}
.dots{display:flex;justify-content:center;gap:4px;padding-top:8px}.dots i{width:6px;height:6px;border-radius:50%;background:var(--hair)}.dots i.on{background:var(--sun)}
.ip .acts{padding:6px 14px 2px}
.cap{padding:2px 14px 6px;font-size:13px;line-height:1.35}.cap b{font-weight:600;margin-right:5px}
.wt{color:#fff}.wt .bg{position:absolute;inset:0}.wt .bg:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.5),transparent 20%,transparent 52%,rgba(0,0,0,.82))}
.wt .sb{position:relative;z-index:2}
.wtop{position:relative;z-index:2;display:flex;justify-content:center;gap:20px;padding:6px 0;font:600 15px var(--body);color:rgba(255,255,255,.62)}.wtop .on{color:#fff;box-shadow:0 2px 0 #fff}
.rail{position:absolute;right:10px;bottom:150px;z-index:2;display:flex;flex-direction:column;align-items:center;gap:15px;font:600 11.5px var(--body)}
.rail span{display:flex;flex-direction:column;align-items:center;gap:3px}.rail .ic{width:29px;height:29px}
.rav{position:relative;margin-bottom:6px}.rav .pl{position:absolute;left:50%;bottom:-8px;margin-left:-9px;width:18px;height:18px;border-radius:50%;background:var(--sun);color:#1a1008;display:grid;place-items:center}.rav .pl .ic{width:12px;height:12px;stroke-width:3}
.winfo{position:absolute;left:14px;right:72px;bottom:100px;z-index:2}
.winfo .who b{font-size:15px}.winfo .hd{color:rgba(255,255,255,.7);font-size:12px}
.winfo p{margin-top:5px;font-size:13.5px;line-height:1.35}
.gl.st{position:static;margin-top:9px}
.snd{display:flex;align-items:center;gap:6px;margin-top:8px;font:500 12px var(--body)}.snd .ic{width:14px;height:14px}
.wcr{display:block;margin-top:5px;font-size:10px;color:rgba(255,255,255,.6)}
.wbar{position:absolute;left:14px;right:14px;bottom:88px;height:3px;border-radius:2px;background:rgba(255,255,255,.25);z-index:2}.wbar i{display:block;height:100%;background:#fff;border-radius:2px}
.wt .tabs{background:rgba(24,19,16,.78);backdrop-filter:blur(16px)}

.pt{padding:2px 16px 0;flex:none}.pt b{font:700 18px/1.15 var(--disp);letter-spacing:-.03em}.pt p{margin-top:4px;color:var(--tx2);font-size:13px}
.proof{margin:10px 14px 0;padding:11px 12px;border-radius:16px;background:var(--s1);box-shadow:0 0 0 1px var(--hair);display:grid;grid-template-columns:34px 1fr;gap:4px 10px;flex:none}
.night .proof{background:linear-gradient(135deg,rgba(255,150,50,.16),rgba(255,255,255,.03))}
.proof b{font:600 13px var(--body);display:block}.proof span{display:block;font:500 12px var(--body);color:var(--tx2)}.proof small{display:block;font:500 10.5px var(--body);color:var(--tx3);margin-top:1px}
.seal{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--sun2),var(--sun));display:grid!important;place-items:center;color:#1a1008!important}.seal .ic{width:19px;height:19px;stroke-width:2}
.rep{grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:7px;height:32px;border-radius:11px;background:var(--bg);border:1px solid var(--hair);font:600 12.5px var(--body);margin-top:4px}.rep .ic{width:15px;height:15px}
.why{display:flex;align-items:center;gap:8px;margin:9px 16px 0;font:500 11.5px var(--body);color:var(--tx3)}.why .ic{width:15px;height:15px;color:var(--sun)}
.reps{padding:6px 14px 0}.rp{display:flex;gap:9px;padding:8px 2px;border-top:1px solid var(--hair);align-items:flex-start}.rp p{font-size:12.5px;margin-top:1px}
.comp{position:absolute;left:12px;right:12px;bottom:14px;height:46px;border-radius:23px;background:var(--s2);display:flex;align-items:center;gap:10px;padding:0 6px 0 16px;color:var(--tx3);font:500 13.5px var(--body)}
.comp .rpl{flex:1}.comp i{width:34px;height:34px;border-radius:50%;background:var(--sun);color:#1a1008;display:grid;place-items:center}.comp i .ic{width:17px;height:17px;stroke-width:2}
.spl{display:flex;align-items:center;gap:8px;padding:0 16px;height:34px;flex:none;font:400 12.5px/1 var(--body);color:var(--tx2)}
.spl span{font:600 10px var(--body);letter-spacing:.06em;color:var(--tx3)}
.spl p{flex:1;min-width:0;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spl b{font-weight:600;color:var(--tx)}.spl i{font-style:normal;margin-left:6px}.spl i:empty{display:none}`;

export const screens = {
  feed,
  explore,
  profile,
  post,
  watch: watch({ f: "nightstreet", face: "nightstreet", name: "Haru Walks", handle: "haru.walks", text: "Old town after the rain, the alleys nobody films. Part 3 of 5.", cr: "Still: dalecruse, CC BY", sound: "Original sound, Haru Walks", likes: "48.2k", comments: "1.1k", reposts: "3.4k" }),
  ink: watch({ f: "tattooleg", face: "tattooleg", name: "Ivy Needle", handle: "ivy.needle", text: "Six hours of linework in 30 seconds. Healed shot next week.", cr: "Still: Carrie Capri, PDM", sound: "Original sound, Ivy Needle", likes: "21.7k", comments: "684", reposts: "1.9k", prog: 72 }),
};

export const usedWork = ["nightstreet", "tattooleg", "guitar", "lanterns", "stairs", "ramen", "reddance", "ceramics", "lettering", "kimono", "swirl3d", "balletfeet", "yarn", "watercolor", "mural", "records"];
