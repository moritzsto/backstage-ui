/*
 * Copyright 2020 The Backstage Authors
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

import { renderHook, act } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { createVersionedContextForTesting } from '@backstage/version-bridge';
import { useRouteRef } from './useRouteRef';
import { createRouteRef } from './RouteRef';
import { TestApiProvider } from '@backstage/test-utils';
import { routeResolutionApiRef } from '../apis';
import { navigationControllerApiRef } from './NavigationControllerApi';
import type { NavigationControllerApi } from './NavigationControllerApi';
import type { Observable, Observer } from '@backstage/types';
import type { RoutingLocation } from './RoutingContract';

function createMockNavigationController(
  initialPath: string = '/',
): NavigationControllerApi & {
  push(path: string): void;
} {
  let current: RoutingLocation = {
    pathname: initialPath,
    search: '',
    hash: '',
  };
  const subscribers = new Set<Observer<RoutingLocation>>();

  const location$: Observable<RoutingLocation> = {
    subscribe(
      observerOrNext?:
        | Observer<RoutingLocation>
        | ((value: RoutingLocation) => void),
    ) {
      const handler: Observer<RoutingLocation> =
        typeof observerOrNext === 'function'
          ? { next: observerOrNext }
          : observerOrNext ?? {};
      subscribers.add(handler);
      handler.next?.(current);
      return {
        unsubscribe() {
          subscribers.delete(handler);
        },
        closed: false,
      };
    },
    [Symbol.observable]() {
      return this;
    },
  };

  return {
    navigate(path: string, _options?: { replace?: boolean }) {
      const url = new URL(path, 'http://localhost');
      current = {
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
      };
      subscribers.forEach(s => s.next?.(current));
    },
    location$,
    push(path: string) {
      const url = new URL(path, 'http://localhost');
      current = {
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
      };
      subscribers.forEach(s => s.next?.(current));
    },
  };
}

describe('v1 consumer', () => {
  const context = createVersionedContextForTesting('routing-context');

  afterEach(() => {
    context.reset();
  });

  it('should resolve routes', () => {
    const resolve = jest.fn(() => () => '/hello');

    const routeRef = createRouteRef();
    const navController = createMockNavigationController('/my-page');

    const renderedHook = renderHook(() => useRouteRef(routeRef), {
      wrapper: ({ children }: PropsWithChildren<{}>) => (
        <TestApiProvider
          apis={[
            [routeResolutionApiRef, { resolve }],
            [navigationControllerApiRef, navController],
          ]}
        >
          {children}
        </TestApiProvider>
      ),
    });

    const routeFunc = renderedHook.result.current;
    expect(routeFunc?.()).toBe('/hello');
    expect(resolve).toHaveBeenCalledWith(
      routeRef,
      expect.objectContaining({
        sourcePath: '/my-page',
      }),
    );
  });

  it('should ignore missing routes', () => {
    const routeRef = createRouteRef();
    const navController = createMockNavigationController('/my-page');

    const renderedHook = renderHook(() => useRouteRef(routeRef), {
      wrapper: ({ children }: PropsWithChildren<{}>) => (
        <TestApiProvider
          apis={[
            [routeResolutionApiRef, { resolve: () => undefined }],
            [navigationControllerApiRef, navController],
          ]}
        >
          {children}
        </TestApiProvider>
      ),
    });

    const routeFunc = renderedHook.result.current;
    expect(routeFunc).toBeUndefined();
  });

  it('re-resolves the routeFunc when the search parameters change', () => {
    const resolve = jest.fn(() => () => '/hello');

    const routeRef = createRouteRef();
    const navController = createMockNavigationController('/my-page');

    const { rerender } = renderHook(() => useRouteRef(routeRef), {
      wrapper: ({ children }: PropsWithChildren<{}>) => (
        <TestApiProvider
          apis={[
            [routeResolutionApiRef, { resolve }],
            [navigationControllerApiRef, navController],
          ]}
        >
          {children}
        </TestApiProvider>
      ),
    });

    const callsBefore = resolve.mock.calls.length;

    act(() => {
      navController.push('/my-new-page');
    });
    rerender();

    expect(resolve.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('does not re-resolve the routeFunc the location pathname does not change', () => {
    const resolve = jest.fn(() => () => '/hello');
    const api = { resolve };

    const routeRef = createRouteRef();
    const navController = createMockNavigationController('/my-page');

    const { rerender } = renderHook(() => useRouteRef(routeRef), {
      wrapper: ({ children }: PropsWithChildren<{}>) => (
        <TestApiProvider
          apis={[
            [routeResolutionApiRef, api],
            [navigationControllerApiRef, navController],
          ]}
        >
          {children}
        </TestApiProvider>
      ),
    });

    expect(resolve).toHaveBeenCalledTimes(1);

    act(() => {
      navController.push('/my-page');
    });
    rerender();

    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('does not re-resolve the routeFunc when the search parameter changes', () => {
    const resolve = jest.fn(() => () => '/hello');
    const api = { resolve };

    const routeRef = createRouteRef();
    const navController = createMockNavigationController('/my-page');

    const { rerender } = renderHook(() => useRouteRef(routeRef), {
      wrapper: ({ children }: PropsWithChildren<{}>) => (
        <TestApiProvider
          apis={[
            [routeResolutionApiRef, api],
            [navigationControllerApiRef, navController],
          ]}
        >
          {children}
        </TestApiProvider>
      ),
    });

    expect(resolve).toHaveBeenCalledTimes(1);

    act(() => {
      navController.push('/my-page?foo=bar');
    });
    rerender();

    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('does not re-resolve the routeFunc when the hash parameter changes', () => {
    const resolve = jest.fn(() => () => '/hello');
    const api = { resolve };

    const routeRef = createRouteRef();
    const navController = createMockNavigationController('/my-page');

    const { rerender } = renderHook(() => useRouteRef(routeRef), {
      wrapper: ({ children }: PropsWithChildren<{}>) => (
        <TestApiProvider
          apis={[
            [routeResolutionApiRef, api],
            [navigationControllerApiRef, navController],
          ]}
        >
          {children}
        </TestApiProvider>
      ),
    });

    expect(resolve).toHaveBeenCalledTimes(1);

    act(() => {
      navController.push('/my-page#foo');
    });
    rerender();

    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
