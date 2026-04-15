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

import { render, act } from '@testing-library/react';
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useHref,
  useNavigate,
  useResolvedPath,
} from 'react-router-dom';
import { RoutingContract, RoutingLocation } from '../routing';
import { ScopedRouterProvider } from './ScopedRouterProvider';

function createMockContract(
  initialLocation: RoutingLocation = {
    pathname: '/',
    search: '',
    hash: '',
    state: null,
  },
): RoutingContract & {
  pushLocation: (loc: RoutingLocation) => void;
  navigateCalls: Array<{
    to: string;
    options?: { replace?: boolean; state?: unknown };
  }>;
} {
  let currentLocation = initialLocation;
  const listeners = new Set<(loc: RoutingLocation) => void>();
  const navigateCalls: Array<{
    to: string;
    options?: { replace?: boolean; state?: unknown };
  }> = [];

  return {
    basePath: '/test',
    location$: {
      subscribe(
        observerOrNext?:
          | { next?: (value: RoutingLocation) => void }
          | ((value: RoutingLocation) => void),
      ) {
        const next =
          typeof observerOrNext === 'function'
            ? observerOrNext
            : observerOrNext?.next;
        if (next) {
          listeners.add(next);
          // Emit current value on subscribe (BehaviorSubject-like)
          next(currentLocation);
        }
        return {
          unsubscribe: () => {
            if (next) listeners.delete(next);
          },
          closed: false,
        };
      },
      [Symbol.observable]() {
        return this;
      },
    },
    navigate(to: string, options?: { replace?: boolean; state?: unknown }) {
      navigateCalls.push({ to, options });
    },
    pushLocation(loc: RoutingLocation) {
      currentLocation = loc;
      listeners.forEach(fn => fn(currentLocation));
    },
    navigateCalls,
  };
}

describe('ScopedRouterProvider', () => {
  it('should provide a scoped React Router context for Routes/Route', () => {
    const contract = createMockContract({
      pathname: '/hello',
      search: '',
      hash: '',
      state: null,
    });

    const { getByText } = render(
      <ScopedRouterProvider contract={contract}>
        <Routes>
          <Route path="/hello" element={<div>Hello Page</div>} />
          <Route path="*" element={<div>Not Found</div>} />
        </Routes>
      </ScopedRouterProvider>,
    );

    expect(getByText('Hello Page')).toBeInTheDocument();
  });

  it('should support Navigate redirects within scoped context', () => {
    const contract = createMockContract({
      pathname: '/',
      search: '',
      hash: '',
      state: null,
    });

    render(
      <ScopedRouterProvider contract={contract}>
        <Routes>
          <Route index element={<Navigate to="/target" replace />} />
          <Route path="/target" element={<div>Target Page</div>} />
        </Routes>
      </ScopedRouterProvider>,
    );

    // Navigate should trigger contract.navigate
    expect(contract.navigateCalls.length).toBeGreaterThan(0);
  });

  it('should update when the contract location changes', () => {
    const contract = createMockContract({
      pathname: '/page-a',
      search: '',
      hash: '',
      state: null,
    });

    function LocationDisplay() {
      const location = useLocation();
      return <div data-testid="location">{location.pathname}</div>;
    }

    const { getByTestId } = render(
      <ScopedRouterProvider contract={contract}>
        <LocationDisplay />
      </ScopedRouterProvider>,
    );

    expect(getByTestId('location').textContent).toBe('/page-a');

    act(() => {
      contract.pushLocation({
        pathname: '/page-b',
        search: '',
        hash: '',
        state: null,
      });
    });

    expect(getByTestId('location').textContent).toBe('/page-b');
  });

  it('should pass state through to useLocation().state', () => {
    const contract = createMockContract({
      pathname: '/page',
      search: '',
      hash: '',
      state: { from: '/login', returnTo: '/dashboard' },
    });

    function StateDisplay() {
      const location = useLocation();
      return <div data-testid="state">{JSON.stringify(location.state)}</div>;
    }

    const { getByTestId } = render(
      <ScopedRouterProvider contract={contract}>
        <StateDisplay />
      </ScopedRouterProvider>,
    );

    expect(JSON.parse(getByTestId('state').textContent!)).toEqual({
      from: '/login',
      returnTo: '/dashboard',
    });
  });

  it('should render children directly when no contract is provided', () => {
    const { getByText } = render(
      <ScopedRouterProvider contract={undefined}>
        <div>Passthrough Content</div>
      </ScopedRouterProvider>,
    );

    expect(getByText('Passthrough Content')).toBeInTheDocument();
  });

  describe('basename support', () => {
    it('should produce correct href with basename', () => {
      const contract = createMockContract({
        pathname: '/',
        search: '',
        hash: '',
        state: null,
      });

      function HrefDisplay() {
        const href = useHref('/catalog');
        return <div data-testid="href">{href}</div>;
      }

      const { getByTestId } = render(
        <ScopedRouterProvider contract={contract} basename="/backstage">
          <HrefDisplay />
        </ScopedRouterProvider>,
      );

      // useHref("/catalog") with basename="/backstage" should produce "/backstage/catalog"
      expect(getByTestId('href').textContent).toBe('/backstage/catalog');
    });

    it('should strip basename before forwarding navigate to contract', () => {
      const contract = createMockContract({
        pathname: '/',
        search: '',
        hash: '',
        state: null,
      });

      function NavTrigger() {
        const navigate = useNavigate();
        return (
          <button onClick={() => navigate('/catalog')} data-testid="nav-btn">
            Navigate
          </button>
        );
      }

      const { getByTestId } = render(
        <ScopedRouterProvider contract={contract} basename="/backstage">
          <NavTrigger />
        </ScopedRouterProvider>,
      );

      act(() => {
        getByTestId('nav-btn').click();
      });

      // React Router prepends basename -> "/backstage/catalog"
      // navigator.push should strip basename before calling contract.navigate
      // so the contract receives "/catalog" (without basename)
      expect(contract.navigateCalls).toEqual([
        { to: '/catalog', options: { state: undefined } },
      ]);
    });

    it('should strip basename from replace navigation', () => {
      const contract = createMockContract({
        pathname: '/',
        search: '',
        hash: '',
        state: null,
      });

      function NavTrigger() {
        const navigate = useNavigate();
        return (
          <button
            onClick={() => navigate('/settings', { replace: true })}
            data-testid="nav-btn"
          >
            Navigate
          </button>
        );
      }

      const { getByTestId } = render(
        <ScopedRouterProvider contract={contract} basename="/backstage">
          <NavTrigger />
        </ScopedRouterProvider>,
      );

      act(() => {
        getByTestId('nav-btn').click();
      });

      expect(contract.navigateCalls).toEqual([
        {
          to: '/settings',
          options: { replace: true, state: undefined },
        },
      ]);
    });

    it('should default basename to empty string', () => {
      const contract = createMockContract({
        pathname: '/',
        search: '',
        hash: '',
        state: null,
      });

      function HrefDisplay() {
        const href = useHref('/catalog');
        return <div data-testid="href">{href}</div>;
      }

      const { getByTestId } = render(
        <ScopedRouterProvider contract={contract}>
          <HrefDisplay />
        </ScopedRouterProvider>,
      );

      // Without basename, href should be just "/catalog"
      expect(getByTestId('href').textContent).toBe('/catalog');
    });
  });

  describe('RouteContext provider', () => {
    it('should provide RouteContext so useResolvedPath works', () => {
      const contract = createMockContract({
        pathname: '/current',
        search: '',
        hash: '',
        state: null,
      });

      function ResolvedPathDisplay() {
        const resolved = useResolvedPath('/absolute');
        return <div data-testid="resolved">{resolved.pathname}</div>;
      }

      const { getByTestId } = render(
        <ScopedRouterProvider contract={contract}>
          <ResolvedPathDisplay />
        </ScopedRouterProvider>,
      );

      // Absolute path should resolve to itself
      expect(getByTestId('resolved').textContent).toBe('/absolute');
    });
  });

  describe('root contract (desync fix)', () => {
    it('should reflect location changes immediately from contract', () => {
      const contract = createMockContract({
        pathname: '/initial',
        search: '',
        hash: '',
        state: null,
      });

      function LocationDisplay() {
        const location = useLocation();
        return <div data-testid="location">{location.pathname}</div>;
      }

      const { getByTestId } = render(
        <ScopedRouterProvider contract={contract}>
          <LocationDisplay />
        </ScopedRouterProvider>,
      );

      expect(getByTestId('location').textContent).toBe('/initial');

      // Simulate NavigationController emitting a new location
      act(() => {
        contract.pushLocation({
          pathname: '/catalog/entity/foo',
          search: '',
          hash: '',
          state: null,
        });
      });

      // Should update immediately — no stale state
      expect(getByTestId('location').textContent).toBe('/catalog/entity/foo');
    });

    it('should allow nesting plugin ScopedRouterProvider inside root', () => {
      const rootContract = createMockContract({
        pathname: '/catalog/entity/foo',
        search: '',
        hash: '',
        state: null,
      });

      const pluginContract = createMockContract({
        pathname: '/entity/foo',
        search: '',
        hash: '',
        state: null,
      });

      function LocationDisplay({ testId }: { testId: string }) {
        const location = useLocation();
        return <div data-testid={testId}>{location.pathname}</div>;
      }

      const { getByTestId } = render(
        <ScopedRouterProvider contract={rootContract}>
          <LocationDisplay testId="root-location" />
          <ScopedRouterProvider contract={pluginContract}>
            <LocationDisplay testId="plugin-location" />
          </ScopedRouterProvider>
        </ScopedRouterProvider>,
      );

      // Root sees full path, plugin sees scoped path
      expect(getByTestId('root-location').textContent).toBe(
        '/catalog/entity/foo',
      );
      expect(getByTestId('plugin-location').textContent).toBe('/entity/foo');
    });
  });
});
