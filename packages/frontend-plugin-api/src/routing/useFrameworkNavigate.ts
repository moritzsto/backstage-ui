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

import { useApi } from '../apis';
import { navigationControllerApiRef } from './NavigationControllerApi';
import { useCallback } from 'react';

/** @public */
export function useFrameworkNavigate(): (
  path: string,
  options?: { replace?: boolean; state?: unknown },
) => void {
  const nav = useApi(navigationControllerApiRef);
  return useCallback(
    (path: string, options?: { replace?: boolean; state?: unknown }) => {
      nav.navigate(path, options);
    },
    [nav],
  );
}
