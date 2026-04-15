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

import { createApiRef } from '../apis';
import type { Observable } from '@backstage/types';
import type { RoutingLocation } from './RoutingContract';

/** @public */
export interface NavigationControllerApi {
  navigate(
    path: string,
    options?: { replace?: boolean; state?: unknown },
  ): void;
  readonly location$: Observable<RoutingLocation>;
}

/** @public */
export const navigationControllerApiRef = createApiRef<NavigationControllerApi>(
  {
    id: 'core.navigation-controller',
  },
);
