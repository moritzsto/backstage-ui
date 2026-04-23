---
'@backstage/plugin-scaffolder-backend-module-github': patch
---

Added a fallback for `publish:github` and `github:repo:push` actions that retries via the GitHub REST API when the git push fails with `ECONNRESET`. The git smart HTTP protocol sends binary pack data in a POST request which can be blocked by network proxies that perform deep packet inspection. The REST API fallback uses standard JSON requests which are not affected.
