# Tools

| Job | Tool script | Run it | Writes to | Area |
| --- | --- | --- | --- | --- |
| Plan: every step + decision + name options, click to decide, each click reaches Claude | `plan/server.mjs` | `npm run plan` (http://agora.localhost:5035) | `data/plan.json`, `data/feedback.jsonl` | Plan |
| Atlas: a live map of the product built from the code - stories, flows, system graph, coverage, platforms | `tools/atlas/build.mjs` | `npm run atlas` (http://agora.localhost:5035/atlas) | `data/atlas.json`, reads `docs/stories.yaml` | Plan |
| Atlas screens: exports the Expo web build in mock mode, signs in, captures every screen (phone and desktop, day and night, plus menu/empty/error states) | `tools/atlas/shots.mjs` | `npm run atlas:shots` or `node tools/atlas/shots.mjs` (re-run after the app changes) | `data/atlas-shots/<screen>/*.png`, `data/atlas-shots/index.json`, then rebuilds `data/atlas.json` | Plan |
