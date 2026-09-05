---
name: OpenAPI codegen (orval) gotchas in this repo
description: What breaks after editing lib/api-spec/openapi.yaml and regenerating the api-zod / api-client-react packages, and the exact recovery steps.
---

# Regenerating clients after an openapi.yaml edit

Run `npx orval --config ./orval.config.ts` from `lib/api-spec` (the package's `codegen` script also chains the libs typecheck).

Two things go wrong every time:

1. **orval rewrites `lib/api-zod/src/index.ts`** to also export the `./generated/types` barrel. That barrel re-declares names already exported by `./generated/api` (e.g. `CheckoutResponse`), so the typecheck fails with a duplicate-export/collision error. Recovery: `git checkout -- lib/api-zod/src/index.ts` (it must export only `./generated/api`).
2. **Generated files come out unformatted**, so the diff is noisy and touches files whose schema did not change (bill.ts, billDetail.ts, ...). Recovery: `npx prettier --write "lib/api-zod/src/generated/**/*.ts" "lib/api-client-react/src/generated/**/*.ts"` — after that only the schemas you actually changed remain in `git status`.

**How to apply:** treat "edit yaml → orval → restore index.ts → prettier → typecheck" as one unit; never hand-edit files under `generated/`. Constraints like `maximum` in the yaml become exported `*Max` constants and `.max()` calls in api-zod — a cheap way to keep client-side limits in step with the server.
