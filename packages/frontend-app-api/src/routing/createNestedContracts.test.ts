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

import { NavigationController } from './NavigationController';
import { createNestedContracts } from './createNestedContracts';

describe('createNestedContracts', () => {
  let controller: NavigationController;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    controller = new NavigationController();
  });

  afterEach(() => {
    controller.dispose();
  });

  it('should create contracts for each declared sub-path', () => {
    const result = createNestedContracts({
      controller,
      parentBasePath: '/catalog',
      subPaths: ['entities', 'components'],
    });

    expect(result.size).toBe(2);
    expect(result.get('entities')).toBeDefined();
    expect(result.get('entities')!.basePath).toBe('/catalog/entities');
    expect(result.get('components')).toBeDefined();
    expect(result.get('components')!.basePath).toBe('/catalog/components');
  });

  it('should return an empty map when no sub-paths are declared', () => {
    const result = createNestedContracts({
      controller,
      parentBasePath: '/catalog',
      subPaths: [],
    });

    expect(result.size).toBe(0);
  });

  it('should handle root parent basePath', () => {
    const result = createNestedContracts({
      controller,
      parentBasePath: '/',
      subPaths: ['catalog'],
    });

    expect(result.size).toBe(1);
    expect(result.get('catalog')!.basePath).toBe('/catalog');
  });

  it('should create navigable contracts', () => {
    window.history.replaceState(null, '', '/catalog/entities/foo');

    const result = createNestedContracts({
      controller,
      parentBasePath: '/catalog',
      subPaths: ['entities'],
    });

    const contract = result.get('entities')!;
    expect(contract.basePath).toBe('/catalog/entities');

    // Contract navigate should work within its scope
    contract.navigate('/bar');
    expect(window.location.pathname).toBe('/catalog/entities/bar');
  });

  it('should handle nested sub-paths with slashes', () => {
    const result = createNestedContracts({
      controller,
      parentBasePath: '/admin',
      subPaths: ['settings/general', 'settings/security'],
    });

    expect(result.size).toBe(2);
    expect(result.get('settings/general')!.basePath).toBe(
      '/admin/settings/general',
    );
    expect(result.get('settings/security')!.basePath).toBe(
      '/admin/settings/security',
    );
  });
});
