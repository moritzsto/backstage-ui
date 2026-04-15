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

import {
  createElement,
  useMemo,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from 'react';
import type { RoutingContract } from '@backstage/frontend-plugin-api';
import {
  UNSAFE_LocationContext,
  UNSAFE_NavigationContext,
  UNSAFE_RouteContext,
  NavigationType,
} from 'react-router';
import type { Navigator } from 'react-router';
import {
  useLocation as useRRLocation,
  useNavigate as useRRNavigate,
  useParams as useRRParams,
  useSearchParams as useRRSearchParams,
} from 'react-router-dom';
import type { Location, NavigateFunction, To } from 'react-router-dom';

/** @public */
export interface ScopedRouterResult {
  Router: ComponentType<{ children: ReactNode }>;
  useLocation: () => Location;
  useNavigate: () => NavigateFunction;
  useParams: <T extends Record<string, string | undefined>>() => T;
  useSearchParams: (
    ...args: Parameters<typeof useRRSearchParams>
  ) => ReturnType<typeof useRRSearchParams>;
  /** Unsubscribes from the contract's location$ observable. */
  dispose: () => void;
}

/** @public */
export function createScopedRouter(
  contract: RoutingContract,
): ScopedRouterResult {
  if (!contract) {
    throw new Error(
      'createScopedRouter requires a RoutingContract. Ensure this component is rendered inside a PageBlueprint.',
    );
  }

  // Store for useSyncExternalStore — keeps the latest location from the contract.
  // The initial value is captured synchronously since contract.location$ emits
  // synchronously on subscribe.
  let latestLocation: Location = {
    pathname: '/',
    search: '',
    hash: '',
    state: null,
    key: 'default',
  };

  // Capture the initial value synchronously
  const initialSub = contract.location$.subscribe(loc => {
    latestLocation = {
      pathname: loc.pathname,
      search: loc.search,
      hash: loc.hash,
      state: loc.state ?? null,
      key: 'default',
    };
  });
  initialSub.unsubscribe();

  // Set of listener callbacks for useSyncExternalStore
  const listeners = new Set<() => void>();

  // Subscription reference — managed by useSyncExternalStore's subscribe lifecycle.
  // React calls subscribe during commit and the returned cleanup on unmount,
  // so this correctly handles Strict Mode and concurrent rendering without
  // requiring render-phase side effects.
  let subscription: { unsubscribe(): void } | undefined;

  function subscribeToContract(): void {
    if (subscription) return;
    subscription = contract.location$.subscribe(routingLocation => {
      latestLocation = {
        pathname: routingLocation.pathname,
        search: routingLocation.search,
        hash: routingLocation.hash,
        state: routingLocation.state ?? null,
        key: 'default',
      };
      for (const listener of listeners) {
        listener();
      }
    });
  }

  function unsubscribeFromContract(): void {
    subscription?.unsubscribe();
    subscription = undefined;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    subscribeToContract();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        unsubscribeFromContract();
      }
    };
  }

  function getSnapshot(): Location {
    return latestLocation;
  }

  function ScopedRouter({ children }: { children: ReactNode }) {
    const location = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    const locationContextValue = useMemo(
      () => ({
        location,
        navigationType: NavigationType.Pop,
      }),
      [location],
    );

    const navigator: Navigator = useMemo(
      () => ({
        createHref(to: To): string {
          if (typeof to === 'string') {
            return to;
          }
          const { pathname = '/', search = '', hash = '' } = to;
          return `${pathname}${search}${hash}`;
        },
        go(delta: number): void {
          // Intentional: delegate to window.history.go()
          // popstate fires and NavigationController catches it
          window.history.go(delta);
        },
        push(to: To, state?: any, _opts?: any): void {
          const path =
            typeof to === 'string'
              ? to
              : createPath(to, latestLocation.pathname);
          contract.navigate(path, { replace: false, state });
        },
        replace(to: To, state?: any, _opts?: any): void {
          const path =
            typeof to === 'string'
              ? to
              : createPath(to, latestLocation.pathname);
          contract.navigate(path, { replace: true, state });
        },
      }),
      [],
    );

    const navigationContextValue = useMemo(
      () => ({
        basename: '',
        navigator,
        static: false,
        future: {
          v7_relativeSplatPath: false,
        },
      }),
      [navigator],
    );

    const routeContextValue = useMemo(
      () => ({
        outlet: null,
        matches: [] as any[],
        isDataRoute: false,
      }),
      [],
    );

    return createElement(
      UNSAFE_NavigationContext.Provider,
      { value: navigationContextValue },
      createElement(
        UNSAFE_LocationContext.Provider,
        { value: locationContextValue },
        createElement(
          UNSAFE_RouteContext.Provider,
          { value: routeContextValue },
          children,
        ),
      ),
    );
  }

  return {
    Router: ScopedRouter,
    useLocation: (): Location => useRRLocation(),
    useNavigate: (): NavigateFunction => useRRNavigate(),
    useParams: <T extends Record<string, string | undefined>>(): T =>
      useRRParams() as T,
    useSearchParams: (...args: Parameters<typeof useRRSearchParams>) =>
      useRRSearchParams(...args),
    dispose: () => {
      unsubscribeFromContract();
      listeners.clear();
    },
  };
}

function createPath(
  to: Partial<{ pathname: string; search: string; hash: string }>,
  currentPathname: string,
): string {
  // Use current pathname when To.pathname is undefined (e.g., useSearchParams
  // updates only search params without specifying a pathname)
  const { pathname = currentPathname, search = '', hash = '' } = to;
  return `${pathname}${search}${hash}`;
}
