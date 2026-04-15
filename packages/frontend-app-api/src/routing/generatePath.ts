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

/**
 * Standalone replacement for react-router's generatePath.
 *
 * Replaces `:param` segments with actual values, handles optional
 * params (`:param?`) and splat routes (`*`).
 *
 * Does NOT call encodeURIComponent — RouteResolver handles its own
 * selective encoding.
 */
export function generatePath(
  pattern: string,
  params: Record<string, string | undefined> = {},
): string {
  return pattern
    .replace(/:(\w+)(\?)?/g, (_, key, optional) => {
      const value = params[key];
      if (value === undefined) {
        if (!optional) {
          throw new Error(
            `Missing required param "${key}" in path "${pattern}"`,
          );
        }
        return '';
      }
      return value;
    })
    .replace(/\*$/, () => params['*'] ?? '')
    .replace(/\/\/+/g, '/');
}
