---
'@backstage/plugin-catalog-backend': patch
---

`FileReaderProcessor` no longer emits a `notFoundError` when a glob pattern matches zero files. Previously, an empty glob match would cause the orchestrator to mark the processing run as failed, which dropped all deferred entities discovered by other targets in the same Location (see #33326). Concrete missing paths still emit `notFoundError` as before — only glob patterns (detected via `glob.hasMagic`) are now treated as non-fatal when they match nothing.
