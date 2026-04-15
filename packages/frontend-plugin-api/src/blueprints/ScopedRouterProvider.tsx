/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useMemo, type ReactNode } from 'react';
import {
  UNSAFE_LocationContext,
  UNSAFE_NavigationContext,
  UNSAFE_RouteContext,
  NavigationType,
} from 'react-router-dom';
import type { RoutingContract } from '../routing';
import {
  useObservableAsState,
  routingLocationEqual,
} from '../routing/useObservableAsState';

/**
 * Sets up a scoped React Router v6 context from a RoutingContract.
 *
 * Uses the UNSAFE_ context APIs from react-router directly instead of
 * `<Router>`, which throws when nested inside another router. This
 * allows multiple independent ScopedRouterProviders (root + per-plugin)
 * without router nesting conflicts.
 *
 * @internal
 */
export function ScopedRouterProvider(props: {
  contract: RoutingContract | undefined;
  children: ReactNode;
  basename?: string;
}) {
  const { contract, children, basename = '' } = props;

  if (!contract) {
    return <>{children}</>;
  }

  return (
    <ScopedRouterProviderInner contract={contract} basename={basename}>
      {children}
    </ScopedRouterProviderInner>
  );
}

function toPath(
  to: string | { pathname?: string; search?: string; hash?: string },
  currentPathname: string,
): string {
  if (typeof to === 'string') {
    return to;
  }
  // Use current pathname when To.pathname is undefined (e.g., useSearchParams
  // updates only search params without specifying a pathname)
  let path = to.pathname ?? currentPathname;
  if (to.search) path += to.search;
  if (to.hash) path += to.hash;
  return path;
}

function stripBasename(path: string, basename: string): string {
  if (!basename) return path;
  if (path === basename) return '/';
  if (path.startsWith(`${basename}/`)) return path.slice(basename.length);
  return path;
}

function ScopedRouterProviderInner(props: {
  contract: RoutingContract;
  children: ReactNode;
  basename: string;
}) {
  const { contract, children, basename } = props;

  const location = useObservableAsState(
    contract.location$,
    routingLocationEqual,
  );

  const routerLocation = useMemo(
    () => ({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      state: location.state ?? null,
      key: 'default',
    }),
    [location.pathname, location.search, location.hash, location.state],
  );

  const navigator = useMemo(
    () => ({
      createHref(to: { pathname?: string; search?: string; hash?: string }) {
        let href = to.pathname ?? '';
        if (to.search) href += to.search;
        if (to.hash) href += to.hash;
        return href;
      },
      go(delta: number) {
        window.history.go(delta);
      },
      push(
        to: string | { pathname?: string; search?: string; hash?: string },
        state?: unknown,
      ) {
        const path = toPath(to, location.pathname);
        contract.navigate(stripBasename(path, basename), { state });
      },
      replace(
        to: string | { pathname?: string; search?: string; hash?: string },
        state?: unknown,
      ) {
        const path = toPath(to, location.pathname);
        contract.navigate(stripBasename(path, basename), {
          replace: true,
          state,
        });
      },
    }),
    [contract, location.pathname, basename],
  );

  const navigationContextValue = useMemo(
    () => ({
      basename,
      navigator,
      static: false,
      future: {
        v7_relativeSplatPath: false,
      },
    }),
    [basename, navigator],
  );

  const locationContextValue = useMemo(
    () => ({
      location: routerLocation,
      navigationType: NavigationType.Pop,
    }),
    [routerLocation],
  );

  const routeContextValue = useMemo(
    () => ({
      outlet: null,
      matches: [],
      isDataRoute: false,
    }),
    [],
  );

  return (
    <UNSAFE_NavigationContext.Provider value={navigationContextValue}>
      <UNSAFE_LocationContext.Provider value={locationContextValue}>
        <UNSAFE_RouteContext.Provider value={routeContextValue}>
          {children}
        </UNSAFE_RouteContext.Provider>
      </UNSAFE_LocationContext.Provider>
    </UNSAFE_NavigationContext.Provider>
  );
}
