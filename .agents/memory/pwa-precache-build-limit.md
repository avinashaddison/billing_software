---
name: PWA precache size limit fails the production build
description: Why a publish can fail with no code error once the web bundle grows, and what the safe fix is (and is not).
---

**Rule:** `vite-plugin-pwa` (workbox `generateSW`) FAILS `vite build` — it does not just warn — when any precache asset exceeds `workbox.maximumFileSizeToCacheInBytes` (default 2 MiB). The toy-mall main chunk crossed 2 MiB in Sep 2026 after ordinary feature growth; dev was unaffected, only the publish build broke. The limit now sits at 5 MiB in `vite.config.ts`.

**Why:** The main bundle is the app and must stay pre-cached for the offline billing flow, so dropping it from the precache is not an option, and `manualChunks` is explicitly ruled out in the config (past attempts leaked React internals across chunks and produced broken production bundles).

**How to apply:**
- A publish failure whose build log ends with "Assets exceeding the limit … won't be precached" is this, not a code error; raise the limit or (the durable fix) route-level `React.lazy` splitting of pages, never `manualChunks`.
- Reproduce locally with `NODE_ENV=production pnpm run build:prod` (the exact deployment build command); watch the "precache N entries (size)" summary.
