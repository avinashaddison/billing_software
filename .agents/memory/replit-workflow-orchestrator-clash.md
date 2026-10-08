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

**Artifact-preview exception:** The registered web artifact has its own workflow
and preview port. A healthy root workflow does not clear that artifact's failed
state. A web-only artifact workflow on a distinct port can safely use the
orchestrator's existing API; do not restart the duplicate API workflow with it.
**Why:** The artifact preview follows its registered service, not the root Run
button. Treat those frontend lifecycles separately while keeping one API owner.
**How to apply:** For an artifact-specific failure, inspect that exact workflow
and its assigned port rather than assuming the root app's health proves it works.

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

### Killing stray API processes safely
`pkill -f 'api-server/dist/index.mjs'` matched the killing shell's OWN command line (the real API cmdline is relative `./dist/index.mjs`) — it killed my shell while the API survived. Use the bracket trick so the pattern can't match itself: `kill $(pgrep -f 'dist/index[.]mjs')`, then verify with `pgrep`, then restart only "Start application".

### Winning the port race (the artifact workflow revives)
- The artifact api-server workflow can REVIVE by itself after a WorkflowsRestart of "Start application" and win the 8080 race with a STALE process (it served an old dist bundle: freshly-mounted routes 404'd/misrouted and boot migrations never ran). "Not authenticated" from a route you just mounted usually means you are talking to the old process, not that auth is broken.
- Reliable sequence: free the port (`fuser -k 8080/tcp` — port-keyed, so it cannot self-match), then restart "Start application" while a short background guard kills any 8080 binder whose /proc ancestry does NOT contain `@workspace/scripts` — the orchestrator's child is the only legitimate owner.
- The orchestrator's API child does NOT hot-reload middleware/route edits: restart "Start application" after server-code changes before re-testing, or you will "verify" the old code.
- **Restarting the per-artifact `api-server` workflow does nothing useful while the orchestrator is up** (Sep 2026): it reports "Restarted" but dies with EADDRINUSE and the orchestrator's stale child keeps serving. Tell-tale: a payload your brand-new validation must reject comes back 201. Before any verification run `pgrep -af 'dist/index[.]mjs'` and compare the PID's start time with your last server edit; if older, restart "Start application" — never the artifact workflow.
- **After a workspace reboot the race can flip** (Sep 2026): the artifact api-server workflow auto-starts first, owns 8080 with whatever dist it built, and `WorkflowsRestart("Start application")` then FAILS with EADDRINUSE — taking web:5000 down with it (the orchestrator exits as a unit, and the artifact web workflow serves on a random port, not 5000). Symptom: old error messages from the API plus `curl 127.0.0.1:5000` dead. Fix: `kill $(pgrep -f 'dist/index[.]mjs')`, confirm it's gone, then restart "Start application" once — 8080 and 5000 come back together. Always check `ps -eo pid,etimes,cmd | grep 'dist/index[.]mjs'` (etimes vs. your edit) before trusting a verification run.
- **`pnpm add` in an artifact reboots every workflow** and can leave ALL of them stopped (both 5000 and 8080 dead, `curl` → 000). Don't debug the new dependency — restart "Start application" once, confirm both ports, then continue.

### When the Replit development URL alone is a 502
- If the workflow is running, Vite reports `0.0.0.0:5000`, and both the local web route and API route return 200, a 502 from the `.replit.dev` URL is a platform forwarding fault. Reapplying the 5000 webview workflow configuration and restarting once is safe; if the URL remains 502, do not rewrite ports or application code.

# Secrets changes reboot the whole environment (seen Sep 2026)

Adding/changing a Replit secret restarted the container: every workflow booted at the
same second, the per-artifact API workflow won 8080, "Start application" died with
EADDRINUSE and port 5000 (the preview) went dark. Worse, the surviving API process was
spawned before the new secret propagated, so it ran WITHOUT the secret even though new
shells already had it — and WorkflowsRestart of "Start application" kept "succeeding"
while the old artifact-owned process stayed on 8080.

**How to apply:** after any secret change, do not trust "restarted". Check
`tr '\0' '\n' < /proc/<api pid>/environ | grep ^NAME=` for the new variable and
`ps -o lstart` for the pid's start time. If the artifact workflow owns 8080, kill its
process tree (pnpm → sh → node), confirm 8080/5000 are free, then restart
"Start application" and re-check the environ.
