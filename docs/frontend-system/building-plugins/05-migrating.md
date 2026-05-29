---
id: migrating
title: Migrating Plugins
sidebar_label: Migration Guide
description: How to migrate an existing frontend plugin to the new frontend system
---

This guide covers how to migrate a frontend plugin and its components, routes, and APIs to the new frontend system (NFS).

The main concept is that routes, components, and APIs are now extensions. You can use the appropriate [extension blueprints](../architecture/23-extension-blueprints.md) to migrate all of them to extensions.

There are two migration paths:

- **Direct migration** — replace the legacy plugin code in place with no compatibility layer. This is the simplest approach and works well for internal plugins where you control all consumers and can cut over in a single change.
- **Phased migration** — add new frontend system support via a separate `/alpha` export while keeping the legacy system working. This is required for published plugins consumed by external Backstage apps, but is also a valid choice for internal plugins where you want a more gradual rollout.

This page covers both paths. If you are doing a phased migration, skip ahead to [Phased migration](#phased-migration).

## Direct migration

In a direct migration you replace the legacy plugin code in place. There is no need to create a separate `src/alpha.tsx` entry point or maintain dual exports.

### Updating the plugin definition

Start by renaming `src/plugin.ts` to `src/plugin.tsx`. Extensions that render JSX (such as pages) require a `.tsx` file, and renaming upfront avoids hard-to-diagnose errors later when you add them.

Replace the `createPlugin` call from `@backstage/core-plugin-api` with `createFrontendPlugin` from `@backstage/frontend-plugin-api`:

```ts title="src/plugin.tsx"
import { createFrontendPlugin } from '@backstage/frontend-plugin-api';

export const myPlugin = createFrontendPlugin({
  // The plugin ID is now provided as `pluginId` instead of `id`
  pluginId: 'my-plugin',
  extensions: [
    /* extensions will go here */
  ],
  routes: {
    // ...
  },
  externalRoutes: {
    // ...
  },
});
```

Then update `src/index.ts` to export the plugin as the default export, which is required for the new frontend system, and update the import path to use the renamed file:

```ts title="src/index.ts"
export { myPlugin as default } from './plugin';
```

### Migrating pages

Replace `createRoutableExtension` with `PageBlueprint`:

```tsx title="src/plugin.tsx"
import {
  createFrontendPlugin,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { rootRouteRef } from './routes';

const fooPage = PageBlueprint.make({
  params: {
    path: '/foo',
    routeRef: rootRouteRef,
    loader: () => import('./components/FooPage').then(m => <m.FooPage />),
  },
});

export const myPlugin = createFrontendPlugin({
  pluginId: 'my-plugin',
  extensions: [fooPage],
  routes: {
    root: rootRouteRef,
  },
});
```

### Migrating utility APIs

Replace `createApiFactory` with `ApiBlueprint` and update the import from `@backstage/core-plugin-api` to `@backstage/frontend-plugin-api`:

```tsx title="src/plugin.tsx"
import { ApiBlueprint, storageApiRef } from '@backstage/frontend-plugin-api';
import { workApiRef } from './api';
import { WorkImpl } from './WorkImpl';

const workApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: workApiRef,
      deps: { storageApi: storageApiRef },
      factory: ({ storageApi }) => new WorkImpl({ storageApi }),
    }),
});
```

Then add the extension to your plugin:

```tsx title="src/plugin.tsx"
export const myPlugin = createFrontendPlugin({
  pluginId: 'my-plugin',
  extensions: [workApi, fooPage],
  routes: {
    root: rootRouteRef,
  },
});
```

### Removing legacy exports

Once you have migrated all extensions, remove any legacy plugin wiring that is no longer needed:

- Exports of components created with `createRoutableExtension` or `createComponentExtension`.
- API factories created with `createApiFactory` that are now handled by `ApiBlueprint`.
- Any `Router` components or route wiring that was previously documented in the plugin README for use in `packages/app`.

:::caution
Before removing legacy exports, make sure no other part of your codebase still imports them. Search for the export names across your app and backend packages before deleting them.
:::

## Phased migration

:::note Note

In a phased migration you keep the old system support intact while adding new frontend system support alongside it. The code added in these examples should go in a new `src/alpha.tsx` entry point of your plugin. This approach is required for published plugins and is also a valid choice for internal plugins that need a more gradual rollout.

:::

In the legacy frontend system a plugin was defined in its own `plugin.ts` file as following:

```ts title="my-plugin/src/plugin.ts"
  import { createPlugin } from '@backstage/core-plugin-api';

  export const myPlugin = createPlugin({
    id: 'my-plugin',
    apis: [ ... ],
    routes: {
      ...
    },
    externalRoutes: {
      ...
    },
  });
```

In order to migrate the actual definition of the plugin you need to recreate the plugin using the new `createFrontendPlugin` utility exported by `@backstage/frontend-plugin-api`. The new `createFrontendPlugin` function doesn't accept apis anymore as apis are now extensions.

```ts title="my-plugin/src/alpha.tsx"
  import { createFrontendPlugin } from '@backstage/frontend-plugin-api';

  export default createFrontendPlugin({
    // The plugin ID is now provided as `pluginId` instead of `id`
    /* highlight-next-line */
    pluginId: 'my-plugin',
    // bind all the extensions to the plugin
    /* highlight-next-line */
    extensions: [/* APIs will go here, but don't worry about those yet */],
    routes: {
      ...
    },
    externalRoutes: {
      ...
    },
  });
```

The code above binds all the extensions to the plugin. _Important_: Make sure to export the plugin as default export of your package as a separate entrypoint, preferably `/alpha`, as suggested by the code snippet above. Make sure `src/alpha.tsx` is exported in your `package.json`:

```ts title="my-plugin/package.json"
  "exports": {
    ".": "./src/index.ts",
    /* highlight-add-next-line */
    "./alpha": "./src/alpha.tsx",
    "./package.json": "./package.json"
  },
  "typesVersions": {
    "*": {
      /* highlight-add-start */
      "alpha": [
        "src/alpha.tsx"
      ],
      /* highlight-add-end */
      "package.json": [
        "package.json"
      ]
    }
  },
```

## Migrating Pages

Pages that were previously created using the `createRoutableExtension` extension function can be migrated to the new Frontend System using the `PageBlueprint` [extension blueprint](../architecture/23-extension-blueprints.md), exported by `@backstage/frontend-plugin-api`.

In the new system plugins provide more information than they used to. For example, the plugin is now responsible for providing the path for the page, rather than it being part of the app code.

For example, given the following page:

```ts
export const FooPage = fooPlugin.provide(
  createRoutableExtension({
    name: 'FooPage',
    component: () => import('./components').then(m => m.FooPage),
    mountPoint: rootRouteRef,
  }),
);
```

and the following instruction in the plugin README:

```tsx
<Route path="/foo" element={<FooPage />} />
```

it can be migrated as the following. Because the `loader` returns a JSX element, any file that uses `PageBlueprint` (or any other blueprint with a JSX loader) must use a `.tsx` extension. Rename the file from `.ts` to `.tsx` if you have not done so already:

```tsx
import { PageBlueprint } from '@backstage/frontend-plugin-api';

const fooPage = PageBlueprint.make({
  params: {
    // This is the path that was previously defined in the app code.
    // It's labelled as the default one because it can be changed via configuration.
    path: '/foo',
    // You can reuse the existing routeRef.
    routeRef: rootRouteRef,
    // these inputs usually match the props required by the component.
    loader: () => import('./components/').then(m => <m.FooPage />),
  },
});
```

Then add the `fooPage` extension to the plugin:

```ts title="my-plugin/src/alpha.tsx"
  import { createFrontendPlugin } from '@backstage/frontend-plugin-api';

  export default createFrontendPlugin({
    pluginId: 'my-plugin',
    // bind all the extensions to the plugin
    /* highlight-remove-next-line */
    extensions: [],
    /* highlight-add-next-line */
    extensions: [fooPage],
    ...
  });
```

## Migrating Components

The equivalent utility to replace components created with `createComponentExtension` depends on the context within which the component is used, typically indicated by the naming pattern of the export. Many of these can be migrated to one of the [existing blueprints](03-common-extension-blueprints.md), but in rare cases it may be necessary to use [`createExtension`](../architecture/20-extensions.md#creating-an-extension) directly.

## Migrating APIs

There are a few things to keep in mind in regards to utility APIs.

### React package interface and ref changes

Let's begin with [your `-react` package](../../architecture-decisions/adr011-plugin-package-structure.md). The act of exporting TypeScript interfaces and API refs have not changed from the old system. You can typically keep those as-is. For illustrative purposes, this is an example of an interface and its API ref:

```tsx title="in @internal/plugin-example-react"
import { createApiRef } from '@backstage/frontend-plugin-api';

/**
 * Performs some work.
 * @public
 */
export interface WorkApi {
  doWork(): Promise<void>;
}

/**
 * The work interface for the Example plugin.
 * @public
 */
export const workApiRef = createApiRef<WorkApi>({
  id: 'plugin.example.work',
});
```

Note at the top of the file that it uses the updated import from `@backstage/frontend-plugin-api` that we migrated in the previous section, instead of the old `@backstage/core-plugin-api`.

Now let's migrate the implementation of the api. Before we changed the `core-plugin-api` imports the api would have looked somewhat similar to the following:

```tsx title="in @internal/plugin-example, NOTE THIS IS LEGACY CODE"
import { storageApiRef, createApiFactory } from '@backstage/core-plugin-api';
import { workApiRef } from '@internal/plugin-example-react';
import { WorkImpl } from './WorkImpl';

const exampleWorkApi = createApiFactory({
  api: workApiRef,
  deps: { storageApi: storageApiRef },
  factory: ({ storageApi }) => new WorkImpl({ storageApi }),
});
```

The major changes we'll make are

- Change the old `@backstage/core-plugin-api` imports to the new `@backstage/frontend-plugin-api` package as per the top section of this guide
- Wrap the existing API factory in a `ApiBlueprint`

The end result, after simplifying imports and cleaning up a bit, might look like this:

```tsx title="in @internal/plugin-example"
import { storageApiRef, ApiBlueprint } from '@backstage/frontend-plugin-api';
import { workApiRef } from '@internal/plugin-example-react';
import { WorkImpl } from './WorkImpl';

const exampleWorkApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: workApiRef,
      deps: { storageApi: storageApiRef },
      factory: ({ storageApi }) => new WorkImpl({ storageApi }),
    }),
});
```

Finally, let's add the `exampleWorkApi` extension to the plugin:

```ts title="my-plugin/src/alpha.tsx"
  import { createFrontendPlugin } from '@backstage/frontend-plugin-api';

  export default createFrontendPlugin({
    pluginId: 'my-plugin',
    // bind all the extensions to the plugin
    /* highlight-remove-next-line */
    extensions: [fooPage],
    /* highlight-add-next-line */
    extensions: [exampleWorkApi, fooPage],
    ...
  });
```

### Further work

Since utility APIs are now complete extensions, you may want to take a bigger look at how they used to be used, and what the new frontend system offers. You may for example consider [adding configurability or inputs](../utility-apis/02-creating.md) to your API, if that makes sense for your current application.
