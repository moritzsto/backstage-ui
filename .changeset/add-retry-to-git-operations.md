---
'@backstage/plugin-scaffolder-node': patch
---

Added retry with exponential back off to `Git.push()`. Scaffolder template actions that create a repository and immediately push to it (e.g., `publish:github`) can encounter transient failures when the repository is not yet fully provisioned. The push is now retried up to 5 times with increasing delays before failing. Authentication and permission errors (401, 403) fail immediately without retrying.
