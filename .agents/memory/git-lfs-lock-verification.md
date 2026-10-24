---
name: Optional Git LFS lock verification
description: Distinguish optional LFS lock permissions from normal Git authentication in this workspace.
---

Treat LFS lock-verification authentication failures separately from source-code failures or ordinary Git authentication. Prefer reversible, repository-local settings over changing credentials, remotes, hooks, or history.

**Why:** Optional lock verification can require permissions unavailable to the workspace. Endpoint-specific LFS settings override the generic setting, so changing only the generic setting may not address the failure. These local Git settings do not travel with source checkpoints.

**How to apply:** When the error specifically says push access is required to verify locks, check both generic and endpoint-specific lock-verification settings. Validate any local override using an LFS dry-run without uploading or pushing; a successful dry-run does not prove that an actual Git push has succeeded.
