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

import { PropsWithChildren } from 'react';
import { renderHook } from '@testing-library/react';
import { useFrameworkNavigate } from './useFrameworkNavigate';
import { navigationControllerApiRef } from './NavigationControllerApi';
import { TestApiProvider } from '@backstage/test-utils';

function createMockNavController(mockNavigate: jest.Mock) {
  return {
    navigate: mockNavigate,
    location$: {
      subscribe: () => ({
        unsubscribe: () => {},
        get closed() {
          return false;
        },
      }),
      [Symbol.observable]() {
        return this;
      },
    },
  };
}

describe('useFrameworkNavigate', () => {
  it('should call navigationController.navigate', () => {
    const mockNavigate = jest.fn();
    const wrapper = ({ children }: PropsWithChildren<{}>) => (
      <TestApiProvider
        apis={[
          [
            navigationControllerApiRef,
            createMockNavController(mockNavigate),
          ] as any,
        ]}
      >
        {children}
      </TestApiProvider>
    );
    const { result } = renderHook(() => useFrameworkNavigate(), { wrapper });
    result.current('/scaffolder/templates/foo');
    expect(mockNavigate).toHaveBeenCalledWith(
      '/scaffolder/templates/foo',
      undefined,
    );
  });

  it('should forward options to navigate', () => {
    const mockNavigate = jest.fn();
    const wrapper = ({ children }: PropsWithChildren<{}>) => (
      <TestApiProvider
        apis={[
          [
            navigationControllerApiRef,
            createMockNavController(mockNavigate),
          ] as any,
        ]}
      >
        {children}
      </TestApiProvider>
    );
    const { result } = renderHook(() => useFrameworkNavigate(), { wrapper });
    result.current('/catalog', { replace: true });
    expect(mockNavigate).toHaveBeenCalledWith('/catalog', { replace: true });
  });
});
