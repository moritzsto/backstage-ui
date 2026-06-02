---
'@backstage/plugin-catalog-backend-module-bitbucket-server': patch
---

Added a Bitbucket Server SCM event translation layer to the catalog backend module. The module now subscribes to Bitbucket Server webhook events and translates them into generic catalog SCM events, enabling instant catalog reprocessing when repositories are pushed to or renamed. The `analyzeBitbucketServerWebhookEvent` function is exported from the alpha entry point for custom integrations.
