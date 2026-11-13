# Tools

| Job | Tool script | Run it | Writes to | Area |
| --- | --- | --- | --- | --- |
| Plan: every step + decision + name options, click to decide, each click reaches Claude | `plan/server.mjs` | `npm run plan` (http://agora.localhost:5035) | `data/plan.json`, `data/feedback.jsonl` | Plan |
| Atlas: a live map of the product built from the code - stories, flows, system graph, coverage, platforms | `tools/atlas/build.mjs` | `npm run atlas` (http://agora.localhost:5035/atlas) | `data/atlas.json`, reads `docs/stories.yaml` | Plan |
