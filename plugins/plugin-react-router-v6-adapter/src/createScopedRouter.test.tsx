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

import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import type {
  RoutingContract,
  RoutingLocation,
} from '@backstage/frontend-plugin-api';
import type { Observer, Subscription } from '@backstage/types';
import { useParams, useOutlet } from 'react-router-dom';
import { createScopedRouter } from './createScopedRouter';

function createMockContract(
  initialLocation: RoutingLocation = {
    pathname: '/catalog/entity/foo',
    search: '',
    hash: '',
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
      _onError?: (error: Error) => void,
      _onComplete?: () => void,
    ): Subscription {
      const observer: Observer<RoutingLocation> =
        typeof observerOrNext === 'function'
          ? { next: observerOrNext }
          : observerOrNext || {};

      observers.add(observer);

      // Emit the current value immediately
      observer.next?.(currentLocation);

      return {
        unsubscribe: () => {
          observers.delete(observer);
        },
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

  return {
    basePath: '/catalog',
    location$,
    navigate,
    emit,
  };
}

describe('createScopedRouter', () => {
  it('should render children inside a React Router context', () => {
    const contract = createMockContract();
    const { Router } = createScopedRouter(contract);

    render(
      <Router>
        <div data-testid="child">Hello</div>
      </Router>,
    );

    expect(screen.getByTestId('child')).toHaveTextContent('Hello');
  });

  it('should sync initial location from contract without flash', () => {
    const contract = createMockContract({
      pathname: '/catalog/entity/bar',
      search: '?q=test',
      hash: '#section',
    });
    const { Router, useLocation } = createScopedRouter(contract);

    const renderedPathnames: string[] = [];

    function LocationDisplay() {
      const location = useLocation();
      renderedPathnames.push(location.pathname);
      return <div data-testid="pathname">{location.pathname}</div>;
    }

    render(
      <Router>
        <LocationDisplay />
      </Router>,
    );

    // The FIRST render must have the correct pathname, not '/'
    expect(renderedPathnames[0]).toBe('/catalog/entity/bar');
    expect(screen.getByTestId('pathname')).toHaveTextContent(
      '/catalog/entity/bar',
    );
  });

  it('should delegate navigate calls to contract', () => {
    const contract = createMockContract();
    const { Router, useNavigate } = createScopedRouter(contract);

    function NavButton() {
      const navigate = useNavigate();
      return (
        <button
          data-testid="nav-btn"
          onClick={() => navigate('/catalog/entity/new')}
        >
          Go
        </button>
      );
    }

    render(
      <Router>
        <NavButton />
      </Router>,
    );

    act(() => {
      screen.getByTestId('nav-btn').click();
    });

    expect(contract.navigate).toHaveBeenCalledWith('/catalog/entity/new', {
      replace: false,
    });
  });

  it('should update when contract emits new location', () => {
    const contract = createMockContract({
      pathname: '/catalog/entity/foo',
      search: '',
      hash: '',
    });
    const { Router, useLocation } = createScopedRouter(contract);

    function LocationDisplay() {
      const location = useLocation();
      return <div data-testid="pathname">{location.pathname}</div>;
    }

    render(
      <Router>
        <LocationDisplay />
      </Router>,
    );

    expect(screen.getByTestId('pathname')).toHaveTextContent(
      '/catalog/entity/foo',
    );

    act(() => {
      contract.emit({
        pathname: '/catalog/entity/updated',
        search: '',
        hash: '',
      });
    });

    expect(screen.getByTestId('pathname')).toHaveTextContent(
      '/catalog/entity/updated',
    );
  });

  it('should stop receiving updates after dispose()', () => {
    const contract = createMockContract({
      pathname: '/catalog/entity/foo',
      search: '',
      hash: '',
    });
    const { Router, useLocation, dispose } = createScopedRouter(contract);

    const renderedPathnames: string[] = [];

    function LocationDisplay() {
      const location = useLocation();
      renderedPathnames.push(location.pathname);
      return <div data-testid="pathname">{location.pathname}</div>;
    }

    render(
      <Router>
        <LocationDisplay />
      </Router>,
    );

    expect(screen.getByTestId('pathname')).toHaveTextContent(
      '/catalog/entity/foo',
    );

    dispose();

    // After dispose, emitting should not update the component
    act(() => {
      contract.emit({
        pathname: '/catalog/entity/after-dispose',
        search: '',
        hash: '',
      });
    });

    // Should still show the old value
    expect(screen.getByTestId('pathname')).toHaveTextContent(
      '/catalog/entity/foo',
    );
  });

  it('should provide UNSAFE_RouteContext with empty defaults', () => {
    const contract = createMockContract();
    const { Router } = createScopedRouter(contract);

    function RouteContextInspector() {
      const params = useParams();
      const outlet = useOutlet();
      return (
        <div>
          <span data-testid="params">{JSON.stringify(params)}</span>
          <span data-testid="outlet">
            {outlet === null ? 'null' : 'present'}
          </span>
        </div>
      );
    }

    render(
      <Router>
        <RouteContextInspector />
      </Router>,
    );

    expect(screen.getByTestId('params')).toHaveTextContent('{}');
    expect(screen.getByTestId('outlet')).toHaveTextContent('null');
  });

  it('should return useLocation, useNavigate, useParams, useSearchParams', () => {
    const contract = createMockContract();
    const result = createScopedRouter(contract);

    expect(result).toHaveProperty('Router');
    expect(result).toHaveProperty('useLocation');
    expect(result).toHaveProperty('useNavigate');
    expect(result).toHaveProperty('useParams');
    expect(result).toHaveProperty('useSearchParams');

    expect(typeof result.Router).toBe('function');
    expect(typeof result.useLocation).toBe('function');
    expect(typeof result.useNavigate).toBe('function');
    expect(typeof result.useParams).toBe('function');
    expect(typeof result.useSearchParams).toBe('function');
  });
});
