---
'@backstage/plugin-catalog-backend': patch
---

Fixed a bug where processing errors emitted by a processor (e.g. a `notFoundError` from `FileReaderProcessor` when a glob pattern matches zero files) would prevent all deferred entities discovered by other processors in the same Location from being persisted. The orchestrator now only marks a result as `ok: false` when processing throws an unexpected exception, not when processors emit errors through the normal emit channel. Processor errors continue to be saved and are visible in the catalog UI.
