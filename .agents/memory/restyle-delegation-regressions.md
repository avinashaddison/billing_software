---
name: Restyle delegation regressions
description: The two regressions parallel design subagents reliably introduce when told a restyle is "purely visual", and how to pre-empt them in the brief.
---

# Restyle delegation regressions

Delegating a "purely visual" restyle across many files to parallel design subagents
works, but a visual-only brief is never honoured literally. Two specific regression
classes show up every time and neither is caught by typecheck or by the subagent's
own self-report — both agents in question reported "all features preserved".

## 1. Error and empty branches lose their actions

A page whose refresh/retry control lives in the header renders that header only on
the success path. When a subagent rewrites the error branch down to a tidy
`<LoadError/>`, the operator hitting a transient failure is stranded with no way to
retry — the only control that could recover the page is behind the state they
cannot reach.

## 2. A shared rounding formatter gets applied to editable previews

Give a design system one money helper and it will be used everywhere, including on
previews of values the user is currently typing. If that helper rounds, the figure
on screen silently stops matching the figure that will be saved (₹999.50 previews
as ₹1,000).

**Why:** subagents optimise hard for the stated visual contract. Conditional
branches read as boilerplate to be simplified, and a single shared formatter reads
as the obviously-correct choice at every call site.

**How to apply:**
- Ship the design system with a non-rounding companion formatter for editable
  values, and say in the primitive's own comment which one is for which.
- Put "every conditional branch keeps its own actions — error states need their own
  retry" in the brief as a hard rule, not an implication of "keep all features".
- Always run an architect review over the git diff afterwards and ask it explicitly
  for dropped controls and changed number formatting. Reviewing the diff catches
  both classes; reading the subagents' summaries catches neither.
- Concurrent agents editing sibling files each run typecheck against the others'
  half-finished state, so their green typecheck means little. Re-run it yourself at
  the end.
