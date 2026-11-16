# Meta app review: Instagram import for Emera (draft for Roy to submit)

Submit in the Meta app dashboard of the Instagram app whose secret is `IG_APP_SECRET` (App Review > Permissions and features). Nothing here has been sent to Meta.

## Permissions requested

| Permission | Why Emera needs it |
| --- | --- |
| `instagram_business_basic` | Read the signed-in creator's own profile (username) and their own media (photos, videos, reels, carousels, captions, dates) so they can copy chosen posts to their Emera profile |

Nothing else. Emera never posts, comments, messages or reads anyone else's content on Instagram.

## Use case text (paste into the form)

Emera (emera.social) is an open-source social network for creators. Creators who join want to bring the work they already made with them instead of uploading every post again by hand.

With "Sign in with Instagram", a creator with a professional (creator or business) account signs in, sees a grid of their own recent posts, taps to choose which ones to bring over, and Emera copies those photos and videos, with their captions and original dates, to the creator's own Emera profile. They can also do the same from an AI assistant they connected to Emera.

We use `instagram_business_basic` only to read the signed-in creator's own username and their own media. We never publish to Instagram, never read other accounts, and never show Instagram data to anyone but the creator until they choose to post it on Emera. A creator can disconnect Instagram at any time in Emera (Settings, Bring your posts), which deletes the stored token.

## Screen recording script (about 60 seconds)

1. Open https://emera.social/connect?ref=meta-review signed in as a test creator. Say: "This is where creators bring their posts to Emera."
2. Tap the Instagram option, then "Sign in with Instagram". Show the Instagram login and the consent screen listing `instagram_business_basic`. Approve.
3. Land on "Instagram connected as @<account>". Tap "Back to Emera".
4. Tap Look: the grid shows the account's own recent reels and photos. Untap two to show the creator picks what comes over.
5. Tap "Bring over 2 posts". Open the Emera profile: both posts show with the same caption and original date.
6. Open Settings, Bring your posts, and tap Disconnect Instagram. Say: "Emera only reads your own posts, and you can disconnect any time."

## Before submitting

1. `key set IG_APP_ID`, then set `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET` on emera-api staging and production (`wrangler secret put`).
2. In the Meta app, add `https://api.emera.social/instagram/callback` (and the staging URL) as valid OAuth redirect URIs.
3. Record the video on staging with a test professional account added as an Instagram tester.
