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

import { Observable } from '@backstage/types';

/** @public */
export interface RoutingLocation {
  pathname: string;
  search: string;
  hash: string;
  state: unknown;
}

/** @public */
export interface RoutingContract {
  readonly basePath: string;
  /**
   * Observable stream of the current location within this contract's scope.
   *
   * **Invariant:** Implementations MUST emit the current location synchronously
   * upon subscription. Router adapters depend on this behavior to capture the
   * initial location without a render cycle delay. An async-emitting implementation
   * will cause adapters to briefly display the wrong route on mount.
   */
  readonly location$: Observable<RoutingLocation>;
  navigate(to: string, options?: { replace?: boolean; state?: unknown }): void;
}
