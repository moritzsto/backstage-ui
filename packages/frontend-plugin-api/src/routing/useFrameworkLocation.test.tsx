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
import { renderHook, act } from '@testing-library/react';
import { useFrameworkLocation } from './useFrameworkLocation';
import { navigationControllerApiRef } from './NavigationControllerApi';
import { TestApiProvider } from '@backstage/test-utils';
import { type RoutingLocation } from './RoutingContract';

describe('useFrameworkLocation', () => {
  function createMockLocationObservable(initial: RoutingLocation) {
    let current = initial;
    const subscribers = new Set<(loc: RoutingLocation) => void>();

    return {
      observable: {
        subscribe(observer: (loc: RoutingLocation) => void) {
          subscribers.add(observer);
          // Emit current value synchronously on subscribe (BehaviorSubject semantics)
          observer(current);
          return {
            unsubscribe: () => subscribers.delete(observer),
            get closed() {
              return false;
            },
          };
        },
        [Symbol.observable]() {
          return this;
        },
      },
      emit(loc: RoutingLocation) {
        current = loc;
        subscribers.forEach(fn => fn(loc));
      },
    };
  }

  function createWrapper(observable: any) {
    return ({ children }: PropsWithChildren<{}>) => (
      <TestApiProvider
        apis={[
          [
            navigationControllerApiRef,
            { navigate: jest.fn(), location$: observable },
          ] as any,
        ]}
      >
        {children}
      </TestApiProvider>
    );
  }

  it('should return the current location from NavigationController', () => {
    const { observable } = createMockLocationObservable({
      pathname: '/catalog',
      search: '?q=test',
      hash: '#section',
    });

    const { result } = renderHook(() => useFrameworkLocation(), {
      wrapper: createWrapper(observable),
    });
    expect(result.current).toEqual({
      pathname: '/catalog',
      search: '?q=test',
      hash: '#section',
    });
  });

  it('should update when location$ emits a new location', () => {
    const { observable, emit } = createMockLocationObservable({
      pathname: '/catalog',
      search: '',
      hash: '',
    });

    const { result } = renderHook(() => useFrameworkLocation(), {
      wrapper: createWrapper(observable),
    });
    expect(result.current.pathname).toBe('/catalog');

    act(() => {
      emit({ pathname: '/scaffolder', search: '', hash: '' });
    });

    expect(result.current.pathname).toBe('/scaffolder');
  });

  it('should maintain referential stability when location has not changed', () => {
    const { observable, emit } = createMockLocationObservable({
      pathname: '/catalog',
      search: '',
      hash: '',
    });

    const { result } = renderHook(() => useFrameworkLocation(), {
      wrapper: createWrapper(observable),
    });
    const first = result.current;

    // Emit the same location — object reference should remain stable
    act(() => {
      emit({ pathname: '/catalog', search: '', hash: '' });
    });

    expect(result.current).toBe(first);
  });
});
