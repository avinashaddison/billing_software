---
name: Callback postprocessing and side effects
description: A failed tool block may already have saved changes before result formatting throws.
---

A CodeExecution error does not mean an earlier mutating callback was rolled
back. Do not repeat a mutation until its resulting state has been checked.

**Why:** Follow-up proposals were saved successfully before array-style result
formatting threw “not a function.” Retrying the whole block would have risked
duplicate proposals.

**How to apply:** Log callback results without assuming an array shape. Inspect
the returned structure before mapping it, and check the current task or
connected-service state before retrying after a postprocessing failure.
