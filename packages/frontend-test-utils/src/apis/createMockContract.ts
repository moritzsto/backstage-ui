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

import {
  RoutingContract,
  RoutingLocation,
} from '@backstage/frontend-plugin-api';
import { Observable, Subscription } from '@backstage/types';

/**
 * Options for creating a mock routing contract.
 *
 * @public
 */
export interface MockContractOptions {
  basePath: string;
  initialLocation?: string;
}

/**
 * A mock routing contract that tracks navigate calls for testing.
 *
 * @public
 */
export interface MockContract extends RoutingContract {
  navigateCalls: Array<{
    to: string;
    options?: { replace?: boolean; state?: unknown };
  }>;
}

function parseLocation(path: string, state?: unknown): RoutingLocation {
  const url = new URL(path, 'http://localhost');
  return {
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    state: state ?? null,
  };
}

/**
 * Creates a mock {@link @backstage/frontend-plugin-api#RoutingContract} for use in tests.
 *
 * @public
 */
export function createMockContract(options: MockContractOptions): MockContract {
  const { basePath, initialLocation = '/' } = options;

  type Observer = ((value: RoutingLocation) => void) | undefined;

  const subscribers = new Set<Observer>();
  let currentLocation = parseLocation(initialLocation);

  const navigateCalls: MockContract['navigateCalls'] = [];

  const location$: Observable<RoutingLocation> = {
    [Symbol.observable]() {
      return this;
    },
    subscribe(
      observerOrNext?:
        | { next?: (value: RoutingLocation) => void }
        | ((value: RoutingLocation) => void),
      _onError?: (error: Error) => void,
      _onComplete?: () => void,
    ): Subscription {
      const next =
        typeof observerOrNext === 'function'
          ? observerOrNext
          : observerOrNext?.next?.bind(observerOrNext);

      subscribers.add(next);

      // Emit initial location immediately
      next?.(currentLocation);

      let closed = false;
      return {
        unsubscribe() {
          subscribers.delete(next);
          closed = true;
        },
        get closed() {
          return closed;
        },
      };
    },
  };

  return {
    basePath,
    location$,
    navigateCalls,
    navigate(to: string, navOptions?: { replace?: boolean; state?: unknown }) {
      navigateCalls.push({ to, options: navOptions });
      currentLocation = parseLocation(to, navOptions?.state);
      for (const subscriber of subscribers) {
        subscriber?.(currentLocation);
      }
    },
  };
}
