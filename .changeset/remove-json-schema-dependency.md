---
'@backstage/backend-plugin-api': patch
'@backstage/config-loader': patch
'@backstage/cli-module-config': patch
'@backstage/plugin-scaffolder-common': patch
'@backstage/plugin-scaffolder-react': patch
'@backstage/plugin-scaffolder': patch
---

Removed unused `json-schema` runtime dependency. The package was only used for TypeScript types from `@types/json-schema`; affected imports have been converted to `import type` to allow safe removal.
