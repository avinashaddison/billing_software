---
name: Own dev orchestrator vs Replit per-artifact workflows (port clash)
description: Why registering artifacts breaks this repo's single-command dev setup, and how to keep the two from fighting over ports.
---

# This repo brings its own dev orchestrator

`pnpm run dev` -> `scripts/src/dev.ts` starts API + web together as one supervised
process pair: API on **8080**, Vite web on **5000** (`WEB_PORT`), with Vite proxying
`/api` -> `localhost:8080`. That single "Start application" workflow is the documented
way to run this project.

# The clash

Registering the artifacts causes Replit to auto-create one workflow **per artifact**
(api-server, toy-mall web, mockup-sandbox). Those duplicate what the orchestrator
already launches, and they win the race for the port:

- api-server artifact workflow binds 8080 first -> the orchestrator's API dies with
  `EADDRINUSE: 0.0.0.0:8080`, which fails the whole `Start application` workflow.
- the toy-mall artifact workflow gets a platform-assigned Vite port (not 5000), so the
  preview on 5000 goes blank even though the app is running fine somewhere else.
- SECOND failure mode (seen Aug 2026): both workflows run `pnpm run build && start` in the
  SAME dist/ dir, so concurrent boots race — one rewrites dist/ while the other starts →
  `Cannot find module .../dist/index.mjs` (MODULE_NOT_FOUND), not a port error at all.
  Whichever loses shows FAILED; the app may still be fine under the winner.

**Why it's easy to misdiagnose:** the symptom looks like "the app is broken" / "preview
is dead", but both servers are actually healthy — they are just on unexpected ports, and
the failing workflow log points at a port bind, not at any application bug.

# How to apply

Pick ONE owner of the ports and make the config agree:
- Keep the orchestrator (matches `replit.md`) and remove/disable the per-artifact
  workflows, **or**
- Keep the per-artifact workflows and update `scripts/src/dev.ts`, the Vite `/api`
  proxy target, and `replit.md` to the real ports.

Do not leave both running. Before debugging any "preview is blank" report on a repo that
has its own dev orchestrator, check the workflow list for duplicates first.
