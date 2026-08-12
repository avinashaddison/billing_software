---
name: lib/db composite build
description: New schema exports in lib/db stay invisible to consumers until the composite project is rebuilt by hand.
---

# lib/db is a composite project with a checked-in stale dist

`lib/db` has **no build script in its package.json**, which makes it look like
a source-only workspace package. It is not: consumers resolve it through its
compiled output, and that output is a real TypeScript project reference.

**The trap:** add a new table file and re-export it from the schema barrel, and
the API still fails to compile with "has no exported member" — the consumer is
reading a stale `dist`. Nothing in the error points at the build.

**Fix:** `npx tsc -b lib/db` after any change to the package's public surface,
before typechecking or restarting anything that imports it.

**Why it matters:** this reads as an import bug or a barrel-export mistake and
sends you editing correct files. Cost a full debugging cycle once.
