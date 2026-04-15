# Plugin Migration Guide: Router-Agnostic Routing

This guide walks through the minimal changes required to migrate a Backstage plugin from the global React Router context to the new router-agnostic `RoutingContract` system. The scaffolder plugin is used as a representative example.

## Overview

The migration touches three areas:

1. **Page extension** -- wrap the plugin's page component in a `ScopedRouterProvider` so it receives its own scoped routing context.
2. **Parameter access** -- replace `useRouteRefParams` with `useParams` from `react-router-dom` (or equivalent), since route parameters are now resolved within the plugin's scoped router.
3. **Tests** -- replace `MemoryRouter` / `renderInTestApp` router setup with `createMockContract` and `NestedRoutingContractProvider`.

---

## 1. Page Extension (Plugin Entry Point)

The plugin's page extension currently mounts via `createRoutableExtension`, which relies on the global `BrowserRouter`. After migration, the `PageBlueprint` automatically provides a `RoutingContract` through `ScopedRouterProvider`, so the plugin's internal `<Routes>` and `<Route>` elements work within a scoped context.

### Before

```tsx
// plugin.tsx
import { createRoutableExtension } from '@backstage/core-plugin-api';
import { rootRouteRef } from './routes';

export const ScaffolderPage = scaffolderPlugin.provide(
  createRoutableExtension({
    name: 'ScaffolderPage',
    component: () => import('./components/Router').then(m => m.Router),
    mountPoint: rootRouteRef,
  }),
);
```

The `Router` component uses `<Routes>` from `react-router-dom` directly, relying on the global browser router:

```tsx
// components/Router/Router.tsx
import { Routes, Route } from 'react-router-dom';

export const Router = (props: RouterProps) => {
  return (
    <Routes>
      <Route path="/" element={<TemplateListPage />} />
      <Route
        path={selectedTemplateRouteRef.path}
        element={<TemplateWizardPage />}
      />
      <Route path={scaffolderTaskRouteRef.path} element={<OngoingTask />} />
      {/* ... more routes */}
    </Routes>
  );
};
```

### After

No changes to the plugin's `Router` component are needed in Phase A. The `PageBlueprint` in `@backstage/frontend-plugin-api` automatically wraps the plugin's content with a `ScopedRouterProvider`:

```tsx
// This happens automatically in PageBlueprint -- no plugin code changes required.
// The ScopedRouterProvider bridges the RoutingContract into React Router's
// UNSAFE_LocationContext and UNSAFE_NavigationContext, so <Routes> and <Route>
// continue to work.
```

When migrating to a different router (Phase D), the plugin would replace `react-router-dom`'s `<Routes>` with its chosen router's equivalent, reading location from the contract:

```tsx
// Phase D example: using the RoutingContract directly
import { useRoutingContract } from '@backstage/frontend-plugin-api';

function MyRouter(props: { children: ReactNode }) {
  const contract = useRoutingContract();
  // Bridge contract.location$ into your preferred router
  // ...
}
```

---

## 2. Replacing `useRouteRefParams` with `useParams`

`useRouteRefParams` resolves parameters by looking up the route ref in the global route resolution table. With scoped routing, parameters are available directly from the URL within the plugin's scoped router context.

### Before

```tsx
// TemplateWizardPage.tsx
import { useRouteRefParams } from '@backstage/core-plugin-api';
import { selectedTemplateRouteRef } from '../../../routes';

function useTemplateWizard(props: TemplateWizardPageProps) {
  const { templateName, namespace } = useRouteRefParams(
    selectedTemplateRouteRef,
  );
  // ...
}
```

### After

```tsx
// TemplateWizardPage.tsx
import { useParams } from 'react-router-dom';

function useTemplateWizard(props: TemplateWizardPageProps) {
  const { templateName, namespace } = useParams<{
    templateName: string;
    namespace: string;
  }>();
  // ...
}
```

The same pattern applies to `OngoingTask.tsx`, which already uses `useParams`:

```tsx
// OngoingTask.tsx -- already correct, no changes needed
import { useParams } from 'react-router-dom';

const { taskId } = useParams();
```

---

## 3. Test Files

Tests that rely on `MemoryRouter` or `renderInTestApp` (which internally wraps with a router) can be updated to use `createMockContract` from `@backstage/frontend-test-utils`.

### Before

```tsx
// Router.test.tsx
import { renderInTestApp } from '@backstage/test-utils';

it('should render the TemplateListPage', async () => {
  await renderInTestApp(<Router />);
  expect(TemplateListPage).toHaveBeenCalled();
});

it('should render the TemplateWizard page', async () => {
  await renderInTestApp(<Router />, {
    routeEntries: ['/templates/default/foo'],
  });
  expect(TemplateWizardPage).toHaveBeenCalled();
});
```

### After

```tsx
// Router.test.tsx
import { createMockContract } from '@backstage/frontend-test-utils';
import { ScopedRouterProvider } from '@backstage/frontend-plugin-api';

function renderWithContract(
  ui: React.ReactElement,
  options?: { initialLocation?: string },
) {
  const contract = createMockContract({
    basePath: '/scaffolder',
    initialLocation: options?.initialLocation ?? '/',
  });

  return {
    contract,
    ...render(
      <ScopedRouterProvider contract={contract}>{ui}</ScopedRouterProvider>,
    ),
  };
}

it('should render the TemplateListPage', () => {
  renderWithContract(<Router />);
  expect(TemplateListPage).toHaveBeenCalled();
});

it('should render the TemplateWizard page', () => {
  renderWithContract(<Router />, {
    initialLocation: '/templates/default/foo',
  });
  expect(TemplateWizardPage).toHaveBeenCalled();
});
```

### Asserting Navigation

The `MockContract` records all `navigate` calls, making it easy to assert navigation behavior:

```tsx
it('should navigate to task page after creation', async () => {
  const { contract } = renderWithContract(<Router />, {
    initialLocation: '/templates/default/foo',
  });

  // ... trigger task creation ...

  expect(contract.navigateCalls).toContainEqual({
    to: '/tasks/my-task-id',
    options: undefined,
  });
});
```

---

## Migration Checklist

For each plugin being migrated:

- [ ] Verify the plugin's `<Routes>` / `<Route>` structure works within a scoped router context (it should, since `ScopedRouterProvider` sets up the same React Router contexts).
- [ ] Replace any `useRouteRefParams(someSubRouteRef)` calls with `useParams()` from `react-router-dom`.
- [ ] Update test files to use `createMockContract` instead of `MemoryRouter` or `renderInTestApp` with `routeEntries`.
- [ ] Run the plugin's test suite: `CI=1 yarn test plugins/<plugin-name>/`
- [ ] Verify the plugin works locally: `yarn start` and navigate to the plugin's page.

## Notes

- **Phase A (current):** No plugin changes are required. The global `BrowserRouter` remains, and `PageBlueprint` provides scoped routers nested inside it. All existing plugins continue to work unchanged.
- **Phase B/C:** App-level chrome migrates away from react-router-dom hooks. The global `BrowserRouter` is eventually removed. Plugins already have scoped routers, so there is zero impact.
- **Phase D:** Individual plugins can opt in to different routers (TanStack Router, React Router v7, etc.) at their own pace by replacing the `ScopedRouterProvider` bridge with their router of choice, reading from the `RoutingContract` directly.
