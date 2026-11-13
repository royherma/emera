# Chat: channels and messages

Two things, one engine:

- **Channels**: topic rooms everyone signed in can read and talk in, like IRC. On desktop they sit in a right-hand rail next to the feed; on phone they are one tap from the feed header. We start with three (`#lobby`, `#feedback`, `#news`) and add more only when one gets busy enough to split.
- **Messages**: private one-to-one conversations (an inbox, plus Requests for people you don't follow).

Later, a **community** is a group of channels with its own moderators. `channels.community_id` is already there (null = Emera-wide), so communities add a table, not a rewrite.

```
 phone / desktop app
        |  HTTPS  (today: poll ?after=cursor every 3 s while the chat is on screen)
        v
 emera-api Worker  --- rules: auth, blocks, requests, rate limits, slow mode, mods
        |
        +--> D1  channel_messages        plain text (public by design)
        |        dm_threads / dm_members  who talks to whom, read state, request state
        |        dm_messages             body sealed with AES-GCM (key: CHAT_KEY secret)
        |        flags                   one moderation queue for posts, accounts, messages
        |
        +--> (step 2) Durable Object per room: WebSocket fan-out, sleeps when idle
```

## Why this shape

| Choice | Why | Rejected |
| --- | --- | --- |
| Chat lives off AT Protocol, in our API | Everything in an AT Protocol repo is public; private messages can never go there. Bluesky's own DMs run as a separate service for the same reason `[inferred]`. | Lexicon records for messages |
| D1 is the one source of truth | Blocks, follows, flags and account deletion already live in D1; one database means one place to delete a person's data and one query to check a block. | Messages stored only inside Durable Objects (a second store to purge and back up) |
| Poll now, Durable Object WebSockets at step 2 | At 50 people with chat open, a 3 s poll is ~17 requests/s, about 43M/month, roughly $10/month on Workers `[inferred, list price]`. A Durable Object with hibernating WebSockets costs close to $0 while idle and delivers in under 100 ms. Switch when 20+ people chat at once; the history endpoints stay the same, only the "something new" signal moves. | A third-party chat SaaS (their servers would hold every DM) |
| Separate tables for channel and DM messages | A bug in the channel query can never return a private message. | One `messages` table with a type column |
| DM bodies sealed at rest, server never reads them | A leaked database copy shows no message text. The server only checks length: no link previews, no search, no AI over DMs. That keeps the door open to end-to-end encryption without changing the data model. | Plain text DMs |

## Privacy and safety rules (built)

1. **Requests, not inbox spam.** A message from someone you don't follow lands in Requests. The sender can send 3 messages until you accept. Accepting moves it to your inbox; declining hides it and they are not told.
2. **Blocks win everywhere.** Either side blocked = no new thread, no new message, the thread disappears from both lists. The error never says who blocked whom.
3. **Rate limits.** 20 messages a minute per person across all chat; channels can add slow mode (seconds between messages per person).
4. **Delete.** You can delete your own message (gone for everyone, the row keeps only "deleted"). Channel moderators can delete any message in their channel; a moderator row with channel `*` moderates every channel.
5. **Report.** Any message can be reported into the existing `flags` queue. For a private message, the reporter's copy of that one message is attached as evidence, so a moderator never has to open anyone's inbox.
6. **Channels are public to members.** The composer says it once: "Everyone on Emera can read #lobby".
7. **No read receipts, no typing dots, no "online" status** in v1. Each one leaks when you are around.

## End-to-end encryption (step 3)

Server-side sealing protects against a leaked database, not against Emera itself. True end-to-end needs keys on each device: MLS (RFC 9420, the standard behind Google Messages and Wire) with a per-device key, backed up with a passphrase. The cost is real: a lost phone with no backup loses history, the web app's keys live in browser storage, and spam filtering can only use reports. Do it once the native app is out and DMs are used; the rule "the server never reads DM bodies" is what makes it a client change rather than a migration.

## Steps

1. Channels + messages on D1, polling (this change).
2. Durable Object `ChatRoom` per channel and thread for live delivery; app swaps the poll for a socket.
3. End-to-end encryption for messages (MLS).
4. Communities: a set of channels, its own moderators and rules page.
