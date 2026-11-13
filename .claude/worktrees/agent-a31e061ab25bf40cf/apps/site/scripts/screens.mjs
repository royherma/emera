const I = (n, c = "") => `<svg class="ic ${c}" viewBox="0 0 24 24"><use href="#i-${n}"/></svg>`;
const img = (f) => `<img src="/assets/work/${f}.jpg" alt="">`;
const av = (f, s = 34, c1 = "#ff9a3c", c2 = "#ff4f8b") =>
  `<span class="av" style="--s:${s}px;--c1:${c1};--c2:${c2}"><i>${img(f)}</i></span>`;
const ver = `<span class="vh">${I("check")}</span>`;
const signed = `<span class="gl pmk">${I("shield")}Signed</span>`;
const credit = (t) => `<span class="gl cr">${t}</span>`;

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
<symbol id="i-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2.5"/><path d="M5 15V7a2 2 0 0 1 2-2h8"/></symbol>
<symbol id="mark" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="currentColor"/><path d="M4 50a46 46 0 0 1 92 0z" fill="url(#sg)"/><path d="M0 50h100" stroke="var(--bg,#fbf5ea)" stroke-width="6"/></symbol>
</defs></svg>`;

const sb = `<div class="sb"><b>9:41</b><span><svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2" width="3" height="10" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".5"/><rect x="2" y="2" width="16" height="8" rx="2"/></svg></span></div>`;

const tabs = (on, face) => `<nav class="tabs"><a class="${on === "home" ? "on" : ""}">${I("home")}</a><a class="${on === "compass" ? "on" : ""}">${I("compass")}</a><a class="plus"><span>${I("plus")}</span></a><a>${I("bell")}<em></em></a><a>${av(face, 28, "#ff9a3c", "#ffc24a")}</a></nav>`;

const acts = (a, b, c, tag, col) =>
  `<div class="acts sm"><span>${I("heart")}${a}</span><span>${I("chat")}${b}</span><span>${I("repeat")}${c}</span><span class="chip" style="--c:${col}"><s></s>${tag}</span></div>`;

const feedPost = (face, name, handle, ago, text, media, cr, a, b, c, tag, col, c1, c2) =>
  `<div class="brow"><div class="lcol">${av(face, 34, c1, c2)}<u></u></div><div class="rcol"><div class="who"><b>${name}</b>${ver}<span class="hd">@${handle}</span><span class="tm">${ago}</span></div><p>${text}</p><div class="media" style="height:${media.h}px">${img(media.f)}${signed}${credit(cr)}</div>${acts(a, b, c, tag, col)}</div></div>`;

const feed = (th) => `<div class="scr ${th}">${sb}
<div class="top"><div class="lg"><svg viewBox="0 0 100 100"><use href="#mark"/></svg>emera</div><div class="tr">${I("search")}${I("bell")}</div></div>
<div class="seg"><a class="on">Following</a><a>Open feeds</a><a>Newest</a></div>
<div class="bl">
${feedPost("guitar", "Dev Rao", "devrao.plays", "4m", "Tuning the Rao family guitar before the festival. Signed live, original take.", { f: "guitar", h: 128 }, "Photo: Mel_DJ, PDM", "2.3k", "274", "184", "Music", "#ff6a5b", "#ff9a3c", "#ff4f8b")}
${feedPost("stairs", "Lina Verdu", "lina.verdu", "12m", "Spiral stair study, Valencia. Third of a series of six.", { f: "stairs", h: 140 }, "Photo: Ian Prince, CC0", "2.1k", "253", "170", "Architecture", "#3dc6c0", "#3dbcf0", "#8a7bff")}
${feedPost("ramen", "Marisol Bakes", "marisol.bakes", "31m", "Day 9 of the starter. Crumb shot at last.", { f: "ramen", h: 130 }, "Photo: CC0", "1.8k", "96", "61", "Food", "#ffc24a", "#ffc24a", "#ff6a2b")}
</div>${tabs("home", "yarn")}</div>`;

const swatches = ["#ffd21f", "#f2634a", "#d8201f", "#9b6bff", "#3b6ea5", "#2c9a6b", "#e0a263", "#8b5a3c", "#e8a89a", "#ffd21f"];
const tile = (f, h, n, c) => `<div class="t" style="height:${h}px">${img(f)}<span class="ct">${I("heart")}${n}</span><span class="pm" style="--c:${c}">${I("shield")}</span></div>`;

const explore = (th) => `<div class="scr ${th}">${sb}
<div class="top solo"><span class="h1">Explore</span></div>
<div class="search">${I("search")}<span>Search makers, works, mediums</span><i>${I("sliders")}</i></div>
<div class="chips"><a class="on"><s style="--c:#ff8a2b"></s>All</a><a><s style="--c:#ff6a5b"></s>Illustration</a><a><s style="--c:#8a7bff"></s>Film</a><a><s style="--c:#ffc24a"></s>Music</a><a><s style="--c:#3dc6c0"></s>Ceramics</a></div>
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

export const screens = { feed, explore, profile, post };

export const usedWork = ["guitar", "stairs", "ramen", "reddance", "ceramics", "lettering", "kimono", "swirl3d", "balletfeet", "yarn", "watercolor", "mural", "records"];
