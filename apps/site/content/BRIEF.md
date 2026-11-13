# SEO content brief (emera.social)

Emera: open-source nonprofit social network on AT Protocol for everyone who makes things AND everyone sharing what is happening (news, local updates, events). Tagline: Where humanity comes together. Prelaunch.

## What Emera may be described as doing (present tense, nothing else)
- Every post carries a signed record (C2PA content credentials) of who shared it and when it went up. A "Signed" badge says exactly what was checked, nothing more.
- People are marked; automated accounts are labeled as automated. The verified human mark is free.
- Reposts point back to the original post.
- Found a copy of your work elsewhere? You report it and Emera helps you file the takedown; every step shows on your dashboard. (Manual. NEVER say Emera scans/watches other platforms automatically.)
- You own your account (AT Protocol): you can move it with your followers to another host.
- A "Why you are seeing this" reason on posts; users can pick feeds.
- Run as a nonprofit, code open source.
NEVER claim: fact-checking, "guaranteed real", AI detection, automatic copy scanning, user counts, press, partners, pricing.

## Copy rules
- Headings never end in a period. No em dashes (use a hyphen or comma). Never use: unlock, elevate, seamless, "whether you're A or B", padded lists of three.
- Never attack another platform. Comparisons are factual and say plainly where the other option is better.
- Short answer: max 420 characters, answers the question in its first sentence.
- Every number or factual claim about a third party is read live this session from a primary source (vendor docs, help center, statute, study) and its URL goes in `sources`. A page that blocks you: write "confirm on <url>" rather than a guess.
- Plain words. Readers are artists, musicians, video makers and people who saw something online and want to know if it is real.
- `html` fields allow only <p> <ul> <ol> <li> <strong> <em> <a href>. No headings inside html.

## Schema (JSON array, one object per page)
{ "slug": "kebab", "kind": "answer"|"compare", "q": "H1, the question as people type it",
  "title": "<=60 chars", "description": "<=155 chars",
  "short": "<=420 chars", "sections": [{"h": "heading", "html": "..."}],
  "table": {"cols": ["", "Emera", "Other"], "rows": [["Feature", "cell", "cell"]]}   (compare only),
  "they_win": ["where the other option is better"]   (compare only),
  "faqs": [{"q": "...", "a": "plain text"}], "sources": [{"label": "...", "url": "https://..."}],
  "checked": "2026-11-13", "related": ["other-slug"] }
Aim: 3-5 sections, 3-5 FAQs, 600-1100 words per page.
