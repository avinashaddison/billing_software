---
name: Vitest pulls a second Vite major
description: Adding vitest silently broke an unrelated artifact's vite config typecheck; pin vitest to the line matching the workspace vite.
---

# Adding vitest can break an unrelated artifact's typecheck

Installing the current vitest into one workspace package pulled in the **next
Vite major** as its own dependency. The frontends stayed on the previous major,
so two Vite copies existed at once and their `Plugin` types stopped being
assignable. The symptom appears in a package that was never touched: a vite
config fails to typecheck with `TS2769: No overload matches this call` on
ordinary plugin calls, with a very long "Type 'Plugin<any>' is not assignable to
type 'PluginOption'" diff naming two different vite paths.

**Fix:** pin vitest to the release line whose peer Vite matches the workspace's
Vite, then run the package manager's dedupe. Check the fix by listing the
resolved vite for each frontend package — they must all resolve to one instance.

**Why it is easy to misdiagnose:** the error points at the victim package's
config file and mentions plugins that were never changed, so it looks like a
plugin bug or a config problem. The cause is a duplicated peer dependency
elsewhere in the monorepo.

**Also worth knowing:** duplicate vite instances can arise purely from a split
in a *transitive* peer (two copies of the same vite version differing only by a
sub-dependency). Dedupe collapses those too; a leftover directory in the package
store does not mean the duplicate is still linked — check what the package
actually resolves to.
