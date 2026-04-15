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

import { type CSSProperties } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestApiProvider } from '@backstage/test-utils';
import { RouteLink } from './RouteLink';
import { createRouteRef } from './RouteRef';
import { routeResolutionApiRef } from '../apis';
import { navigationControllerApiRef } from './NavigationControllerApi';

function createMockNavigationControllerApi() {
  return {
    navigate: jest.fn(),
    location$: {
      subscribe: (
        observerOrNext?:
          | { next?: (value: any) => void }
          | ((value: any) => void),
      ) => {
        const onNext =
          typeof observerOrNext === 'function'
            ? observerOrNext
            : observerOrNext?.next?.bind(observerOrNext);
        // Emit synchronously on subscribe (required by useObservableAsState)
        onNext?.({ pathname: '/', search: '', hash: '' });
        return {
          unsubscribe: () => {},
          get closed() {
            return false;
          },
        };
      },
      [Symbol.observable]() {
        return this;
      },
    },
  };
}

describe('RouteLink', () => {
  const routeRef = createRouteRef();

  function renderRouteLink(
    opts: {
      routeFunc?: () => string;
      params?: Record<string, string>;
      className?: string;
      style?: CSSProperties;
      mockNav?: ReturnType<typeof createMockNavigationControllerApi>;
    } = {},
  ) {
    const routeFunc = opts.routeFunc ?? (() => '/catalog/entity/my-entity');
    const resolve = jest.fn(() => routeFunc);
    const mockNav = opts.mockNav ?? createMockNavigationControllerApi();

    const result = render(
      <TestApiProvider
        apis={[
          [routeResolutionApiRef, { resolve }],
          [navigationControllerApiRef, mockNav as any],
        ]}
      >
        <MemoryRouter initialEntries={['/']}>
          <RouteLink
            routeRef={routeRef}
            params={opts.params}
            className={opts.className}
            style={opts.style}
          >
            Go to entity
          </RouteLink>
        </MemoryRouter>
      </TestApiProvider>,
    );

    return { ...result, resolve, mockNav };
  }

  it('should render an anchor tag with the resolved href', () => {
    renderRouteLink();
    const link = screen.getByRole('link', { name: 'Go to entity' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/catalog/entity/my-entity');
  });

  it('should pass params to the route function', () => {
    const routeFunc = jest.fn(() => '/catalog/entity/foo');
    renderRouteLink({ routeFunc, params: { name: 'foo' } });
    expect(routeFunc).toHaveBeenCalledWith({ name: 'foo' });
  });

  it('should call frameworkNavigate on plain click', () => {
    const mockNav = createMockNavigationControllerApi();
    renderRouteLink({ mockNav });
    const link = screen.getByRole('link', { name: 'Go to entity' });

    fireEvent.click(link);

    expect(mockNav.navigate).toHaveBeenCalledWith(
      '/catalog/entity/my-entity',
      undefined,
    );
  });

  it('should prevent default on plain click', () => {
    renderRouteLink();
    const link = screen.getByRole('link', { name: 'Go to entity' });

    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
    link.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should not call frameworkNavigate on meta+click', () => {
    const mockNav = createMockNavigationControllerApi();
    renderRouteLink({ mockNav });
    const link = screen.getByRole('link', { name: 'Go to entity' });

    fireEvent.click(link, { metaKey: true });

    expect(mockNav.navigate).not.toHaveBeenCalled();
  });

  it('should not call frameworkNavigate on ctrl+click', () => {
    const mockNav = createMockNavigationControllerApi();
    renderRouteLink({ mockNav });
    const link = screen.getByRole('link', { name: 'Go to entity' });

    fireEvent.click(link, { ctrlKey: true });

    expect(mockNav.navigate).not.toHaveBeenCalled();
  });

  it('should not call frameworkNavigate on shift+click', () => {
    const mockNav = createMockNavigationControllerApi();
    renderRouteLink({ mockNav });
    const link = screen.getByRole('link', { name: 'Go to entity' });

    fireEvent.click(link, { shiftKey: true });

    expect(mockNav.navigate).not.toHaveBeenCalled();
  });

  it('should not call frameworkNavigate on right-click', () => {
    const mockNav = createMockNavigationControllerApi();
    renderRouteLink({ mockNav });
    const link = screen.getByRole('link', { name: 'Go to entity' });

    fireEvent.click(link, { button: 2 });

    expect(mockNav.navigate).not.toHaveBeenCalled();
  });

  it('should forward className prop', () => {
    renderRouteLink({ className: 'my-class' });
    const link = screen.getByRole('link', { name: 'Go to entity' });
    expect(link).toHaveClass('my-class');
  });

  it('should forward style prop', () => {
    renderRouteLink({ style: { color: 'red' } });
    const link = screen.getByRole('link', { name: 'Go to entity' });
    expect(link).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('should render children', () => {
    renderRouteLink();
    expect(screen.getByText('Go to entity')).toBeInTheDocument();
  });
});
