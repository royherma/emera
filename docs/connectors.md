# Connectors: places Emera can import from

A connector reads someone's posts from another place so they can bring them to Emera and keep new ones flowing (auto-post). Each one is a single file in `apps/api/src/connectors/` and one line in the `CONNECTORS` list in `apps/api/src/connectors/index.ts`. The app, the MCP tools (`preview_import`, `import_posts`, `auto_post`) and the 15-minute auto-post job pick it up from that list with no other change.

## The contract

```ts
type Connector = {
  id: string;                       // stored in sources.kind, never rename
  name: string;                     // shown in the app: "Bluesky"
  example: string;                  // shown as the hint: "@you.bsky.social"
  match(input: string): string | null; // what the person typed -> a stable spec, or null if not yours
  label(spec: string): string;      // "@you.bsky.social on Bluesky"
  from(spec: string): string;       // what to put back in the input box
  read(spec: string, limit: number): Promise<Item[]>; // newest first
};

type Item = {
  id: string;            // stable and unique across connectors: "bsky:at://...", "feed:<guid>"
  url: string;           // the original post, shown to the person
  caption: string;       // plain text, up to 2200 characters
  createdAt: string | null; // ISO date of the original post
  media: { url: string; type: 'image' | 'video' | null; alt: string }[]; // public https files, up to 10
};
```

Rules a connector must follow:

1. **Only public data, or data the person signed in to share.** No scraping behind a login, no getting around a platform's rules. Places that do not let other apps read posts go in `LOCKED` with a plain sentence on what to do instead.
2. **Fetch with `net` and `UA` from `connectors/types.ts`**, so tests can swap the network and sites see who is asking.
3. **Return only items with photos or videos.** Text-only posts are skipped.
4. **Order matters**: `match` runs in list order and the first hit wins, so specific connectors go before the catch-all `feed`.
5. **Tests**: add a parser test with a saved sample response in `apps/api/test/connect.test.ts`. Never hit the real site in tests.

## Today

| id | Reads | Input |
| --- | --- | --- |
| `bluesky` | public AppView feed, images and video blobs from the person's PDS | `@you.bsky.social`, `bsky.app/profile/...`, a did |
| `mastodon` | the profile's RSS | `https://server/@you` |
| `feed` | any RSS or Atom feed, or a page that links one (Pixelfed, Tumblr, Flickr, blogs) | any link |

Locked, with the reason shown to the person: Instagram, TikTok, X, Facebook.

## Auto-post rules

Each connected source can carry rules (`sources.rules`): `media` (`any`, `photos`, `videos`) and `tag` (only posts whose caption has that hashtag). The auto-post job only brings over items made after auto-post was turned on that pass the rules. The checks live in `passes()` in `connectors/index.ts`.

## Wanted

Pixelfed by handle (`@you@pixelfed.social`), Flickr by username, YouTube Shorts (needs the creator to sign in), Behance, Dribbble, Threads (needs the creator to sign in). Pick one, add a file, open a PR.
