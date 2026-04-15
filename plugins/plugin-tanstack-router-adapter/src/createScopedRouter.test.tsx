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

import { render, act, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type {
  RoutingContract,
  RoutingLocation,
} from '@backstage/frontend-plugin-api';
import type { Observer, Subscription } from '@backstage/types';
import { createScopedRouter } from './createScopedRouter';
import { useRouterState } from '@tanstack/react-router';

function createMockContract(
  initialLocation: RoutingLocation = {
    pathname: '/home',
    search: '',
    hash: '',
    state: undefined,
  },
): RoutingContract & {
  emit: (location: RoutingLocation) => void;
  navigate: jest.Mock;
} {
  let currentLocation = initialLocation;
  const observers = new Set<Observer<RoutingLocation>>();

  const navigate = jest.fn();

  const location$ = {
    subscribe(
      observerOrNext?:
        | Observer<RoutingLocation>
        | ((value: RoutingLocation) => void),
    ): Subscription {
      const observer: Observer<RoutingLocation> =
        typeof observerOrNext === 'function'
          ? { next: observerOrNext }
          : observerOrNext || {};

      observers.add(observer);
      observer.next?.(currentLocation);

      return {
        unsubscribe: () => observers.delete(observer),
        get closed() {
          return !observers.has(observer);
        },
      };
    },
    [Symbol.observable]() {
      return this;
    },
  };

  function emit(location: RoutingLocation) {
    currentLocation = location;
    for (const observer of observers) {
      observer.next?.(location);
    }
  }

  return { basePath: '/home', location$, navigate, emit };
}

describe('createScopedRouter (TanStack)', () => {
  it('should render the RouterProvider without errors', () => {
    const contract = createMockContract();
    const { RouterProvider } = createScopedRouter(contract);

    const { container } = render(<RouterProvider />);
    expect(container).toBeDefined();
  });

  it('should sync initial location from contract', () => {
    const contract = createMockContract({
      pathname: '/home',
      search: '?widget=clock',
      hash: '',
      state: undefined,
    });
    const result = createScopedRouter(contract);

    expect(result.router.state.location.pathname).toBe('/home');
  });

  it('should update when contract emits new location', async () => {
    const contract = createMockContract({
      pathname: '/home',
      search: '',
      hash: '',
      state: undefined,
    });
    const result = createScopedRouter(contract);

    // Subscriptions are only active when RouterProvider is mounted
    render(
      <result.Router>
        <div data-testid="mounted">ok</div>
      </result.Router>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('mounted')).toBeInTheDocument();
    });

    act(() => {
      contract.emit({
        pathname: '/home/dashboard',
        search: '',
        hash: '',
        state: undefined,
      });
    });

    expect(result.router.state.location.pathname).toBe('/home/dashboard');
  });

  it('should clean up subscriptions on dispose', () => {
    const contract = createMockContract();
    const result = createScopedRouter(contract);

    result.dispose();

    // After dispose, emitting should not cause errors or updates
    act(() => {
      contract.emit({
        pathname: '/home/after-dispose',
        search: '',
        hash: '',
        state: undefined,
      });
    });

    // Router should still have the old location
    expect(result.router.state.location.pathname).toBe('/home');
  });

  it('should return a valid router instance', () => {
    const contract = createMockContract();
    const result = createScopedRouter(contract);

    expect(result.router).toBeDefined();
    expect(typeof result.router.navigate).toBe('function');
    expect(typeof result.router.state).toBe('object');
    expect(typeof result.dispose).toBe('function');
    expect(typeof result.RouterProvider).toBe('function');
    expect(typeof result.Router).toBe('function');
  });

  describe('Router (children wrapper)', () => {
    it('should render children inside the TanStack router context', async () => {
      const contract = createMockContract();
      const { Router } = createScopedRouter(contract);

      render(
        <Router>
          <div data-testid="child">Hello from inside TanStack</div>
        </Router>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('child')).toHaveTextContent(
          'Hello from inside TanStack',
        );
      });
    });

    it('should give children access to TanStack router state', async () => {
      const contract = createMockContract({
        pathname: '/home/dashboard',
        search: '?tab=overview',
        hash: '',
        state: undefined,
      });
      const { Router } = createScopedRouter(contract);

      function LocationDisplay() {
        const { location } = useRouterState();
        return <div data-testid="location">{location.pathname}</div>;
      }

      render(
        <Router>
          <LocationDisplay />
        </Router>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('location')).toHaveTextContent(
          '/home/dashboard',
        );
      });
    });

    it('should clean up subscriptions on unmount', async () => {
      const contract = createMockContract();
      const result = createScopedRouter(contract);

      const { unmount } = render(
        <result.Router>
          <div data-testid="content">content</div>
        </result.Router>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('content')).toBeInTheDocument();
      });

      unmount();

      // After unmount, emitting should not cause errors
      act(() => {
        contract.emit({
          pathname: '/home/after-unmount',
          search: '',
          hash: '',
          state: undefined,
        });
      });

      // Router should still have the old location since subscriptions were cleaned up
      expect(result.router.state.location.pathname).toBe('/home');
    });
  });
});
