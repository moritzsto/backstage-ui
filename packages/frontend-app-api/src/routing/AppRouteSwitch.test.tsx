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

import { type ComponentType } from 'react';
import { render, screen, act } from '@testing-library/react';
import { AppRouteSwitch } from './AppRouteSwitch';
import { NavigationController } from './NavigationController';
import { RouteTable } from './RouteTable';
import { useRoutingContract } from '@backstage/frontend-plugin-api';
import type { RoutingContract } from '@backstage/frontend-plugin-api';

function CatalogPage() {
  const contract = useRoutingContract();
  return <div data-testid="catalog-page">Catalog: {contract.basePath}</div>;
}

function ScaffolderPage() {
  const contract = useRoutingContract();
  return (
    <div data-testid="scaffolder-page">Scaffolder: {contract.basePath}</div>
  );
}

function FallbackPage() {
  return <div data-testid="fallback-page">Not Found</div>;
}

describe('AppRouteSwitch', () => {
  let controller: NavigationController;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    controller = new NavigationController();
  });

  afterEach(() => {
    controller.dispose();
  });

  it('should render the matched page component', () => {
    window.history.replaceState(null, '', '/catalog/entities');

    const routeTable = new RouteTable(['/catalog', '/scaffolder']);
    const pages = new Map<string, ComponentType>([
      ['/catalog', CatalogPage],
      ['/scaffolder', ScaffolderPage],
    ]);

    render(
      <AppRouteSwitch
        controller={controller}
        routeTable={routeTable}
        pages={pages}
        fallback={<FallbackPage />}
      />,
    );

    expect(screen.getByTestId('catalog-page')).toHaveTextContent(
      'Catalog: /catalog',
    );
  });

  it('should switch to a different page on navigation', () => {
    window.history.replaceState(null, '', '/catalog');

    const routeTable = new RouteTable(['/catalog', '/scaffolder']);
    const pages = new Map<string, ComponentType>([
      ['/catalog', CatalogPage],
      ['/scaffolder', ScaffolderPage],
    ]);

    render(
      <AppRouteSwitch
        controller={controller}
        routeTable={routeTable}
        pages={pages}
        fallback={<FallbackPage />}
      />,
    );

    expect(screen.getByTestId('catalog-page')).toBeInTheDocument();

    act(() => {
      controller.navigate('/scaffolder/templates');
    });

    expect(screen.getByTestId('scaffolder-page')).toBeInTheDocument();
    expect(screen.getByTestId('scaffolder-page')).toHaveTextContent(
      'Scaffolder: /scaffolder',
    );
  });

  it('should render fallback for unmatched paths', () => {
    window.history.replaceState(null, '', '/unknown/path');

    const routeTable = new RouteTable(['/catalog']);
    const pages = new Map<string, ComponentType>([['/catalog', CatalogPage]]);

    render(
      <AppRouteSwitch
        controller={controller}
        routeTable={routeTable}
        pages={pages}
        fallback={<FallbackPage />}
      />,
    );

    expect(screen.getByTestId('fallback-page')).toBeInTheDocument();
  });

  it('should provide a RoutingContract with correct basePath to the matched page', () => {
    window.history.replaceState(null, '', '/scaffolder/templates');

    const routeTable = new RouteTable(['/catalog', '/scaffolder']);
    const pages = new Map<string, ComponentType>([
      ['/catalog', CatalogPage],
      ['/scaffolder', ScaffolderPage],
    ]);

    render(
      <AppRouteSwitch
        controller={controller}
        routeTable={routeTable}
        pages={pages}
        fallback={<FallbackPage />}
      />,
    );

    expect(screen.getByTestId('scaffolder-page')).toHaveTextContent(
      'Scaffolder: /scaffolder',
    );
  });

  it('should provide a contract whose navigate is scoped to basePath', () => {
    window.history.replaceState(null, '', '/catalog/entities');

    let capturedContract: RoutingContract | undefined;

    function ContractCapture() {
      capturedContract = useRoutingContract();
      return <div>captured</div>;
    }

    const routeTable = new RouteTable(['/catalog']);
    const pages = new Map<string, ComponentType>([
      ['/catalog', ContractCapture],
    ]);

    render(
      <AppRouteSwitch
        controller={controller}
        routeTable={routeTable}
        pages={pages}
        fallback={<FallbackPage />}
      />,
    );

    expect(capturedContract).toBeDefined();
    expect(capturedContract!.basePath).toBe('/catalog');

    act(() => {
      capturedContract!.navigate('/entity/bar');
    });

    expect(window.location.pathname).toBe('/catalog/entity/bar');
  });

  it('should handle root path catch-all', () => {
    window.history.replaceState(null, '', '/something');

    function RootPage() {
      const contract = useRoutingContract();
      return <div data-testid="root-page">Root: {contract.basePath}</div>;
    }

    const routeTable = new RouteTable(['/catalog', '/']);
    const pages = new Map<string, ComponentType>([
      ['/catalog', CatalogPage],
      ['/', RootPage],
    ]);

    render(
      <AppRouteSwitch
        controller={controller}
        routeTable={routeTable}
        pages={pages}
        fallback={<FallbackPage />}
      />,
    );

    expect(screen.getByTestId('root-page')).toHaveTextContent('Root: /');
  });

  it('should catch plugin errors with error boundary and render fallback', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    window.history.replaceState(null, '', '/crashing');

    function CrashingPage(): never {
      throw new Error('Plugin crashed!');
    }

    const routeTable = new RouteTable(['/crashing']);
    const pages = new Map<string, ComponentType>([['/crashing', CrashingPage]]);

    render(
      <AppRouteSwitch
        controller={controller}
        routeTable={routeTable}
        pages={pages}
        fallback={<FallbackPage />}
      />,
    );

    expect(screen.getByTestId('fallback-page')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('/crashing'),
      expect.any(Error),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });

  it('should recover from error boundary when navigating to a different plugin and back', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    window.history.replaceState(null, '', '/crashing');

    function CrashingPage(): never {
      throw new Error('Plugin crashed!');
    }

    const routeTable = new RouteTable(['/crashing', '/ok']);
    const pages = new Map<string, ComponentType>([
      ['/crashing', CrashingPage],
      ['/ok', CatalogPage],
    ]);

    render(
      <AppRouteSwitch
        controller={controller}
        routeTable={routeTable}
        pages={pages}
        fallback={<FallbackPage />}
      />,
    );

    // Plugin crashed — fallback shown
    expect(screen.getByTestId('fallback-page')).toBeInTheDocument();

    // Navigate to working plugin
    act(() => {
      controller.navigate('/ok/entities');
    });
    expect(screen.getByTestId('catalog-page')).toBeInTheDocument();

    // Navigate back to crashing plugin — error boundary resets (key changes)
    // so the plugin gets another chance to render (and will crash again)
    act(() => {
      controller.navigate('/crashing');
    });
    expect(screen.getByTestId('fallback-page')).toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it('should use pre-created contracts from the contracts map', () => {
    window.history.replaceState(null, '', '/catalog/entities');

    const preCreatedContract = controller.createContract('/catalog');
    const contracts = new Map<string, RoutingContract>([
      ['/catalog', preCreatedContract],
    ]);

    let capturedContract: RoutingContract | undefined;

    function ContractCapture() {
      capturedContract = useRoutingContract();
      return <div>captured</div>;
    }

    const routeTable = new RouteTable(['/catalog']);
    const pages = new Map<string, ComponentType>([
      ['/catalog', ContractCapture],
    ]);

    render(
      <AppRouteSwitch
        controller={controller}
        routeTable={routeTable}
        pages={pages}
        contracts={contracts}
        fallback={<FallbackPage />}
      />,
    );

    expect(capturedContract).toBe(preCreatedContract);
  });
});
