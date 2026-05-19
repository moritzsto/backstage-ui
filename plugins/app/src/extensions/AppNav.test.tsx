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

import { screen, waitFor, within } from '@testing-library/react';
import { renderTestApp } from '@backstage/frontend-test-utils';
import {
  PageBlueprint,
  NavItemBlueprint,
  createRouteRef,
} from '@backstage/frontend-plugin-api';

const DEFAULT_CONFIG = {
  app: { baseUrl: 'http://localhost:3000' },
  backend: { baseUrl: 'http://localhost:7007' },
};

const mockPage = PageBlueprint.make({
  name: 'my-plugin',
  params: {
    title: 'My Plugin',
    icon: <span>icon</span>,
    path: '/my-plugin',
    routeRef: createRouteRef(),
  },
});

const mockNavItem = NavItemBlueprint.make({
  name: 'my-plugin',
  params: {
    title: 'My Plugin',
    icon: () => <span>icon</span>,
    routeRef: createRouteRef(),
  },
});

describe('AppNav', () => {
  it('should show a nav item for a page with an enabled nav-item extension', async () => {
    renderTestApp({
      extensions: [mockPage, mockNavItem],
      config: DEFAULT_CONFIG,
    });

    await waitFor(() => {
      expect(
        within(screen.getByRole('navigation')).getByText('My Plugin'),
      ).toBeInTheDocument();
    });
  });

  it('should hide a nav item when its nav-item extension is disabled via config', async () => {
    renderTestApp({
      extensions: [mockPage, mockNavItem],
      config: {
        ...DEFAULT_CONFIG,
        app: {
          ...DEFAULT_CONFIG.app,
          extensions: [{ 'nav-item:test/my-plugin': false }],
        },
      },
    });

    await waitFor(() => {
      expect(
        within(screen.getByRole('navigation')).queryByText('My Plugin'),
      ).not.toBeInTheDocument();
    });
  });

  it('should still show a nav item for a page without a nav-item extension', async () => {
    renderTestApp({
      extensions: [mockPage],
      config: {
        ...DEFAULT_CONFIG,
        app: {
          ...DEFAULT_CONFIG.app,
          extensions: [{ 'nav-item:test/my-plugin': false }],
        },
      },
    });

    await waitFor(() => {
      expect(
        within(screen.getByRole('navigation')).getByText('My Plugin'),
      ).toBeInTheDocument();
    });
  });
});
