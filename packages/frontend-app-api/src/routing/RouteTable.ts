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
 * Provides longest-prefix URL matching for top-level page routing.
 *
 * Routes are sorted by length (longest first) so that the most specific
 * prefix wins. The root path `/` acts as a catch-all.
 *
 * @internal
 */

import { escapeRegExp } from './escapeRegExp';

export class RouteTable {
  private readonly paths: Array<{ path: string; matcher?: RegExp }>;

  constructor(basePaths: string[]) {
    const seen = new Set<string>();
    for (const path of basePaths) {
      if (seen.has(path)) {
        // eslint-disable-next-line no-console
        console.warn(
          `[RouteTable] Duplicate base path "${path}" registered. ` +
            `Only one plugin should claim each base path. The first registration wins.`,
        );
      }
      seen.add(path);
    }
    // Deduplicate — first registration wins (order preserved before sort)
    this.paths = [...new Set(basePaths)]
      .sort((a, b) => b.length - a.length)
      .map(path => ({
        path,
        matcher: path === '/' ? undefined : compileMatcher(path),
      }));
  }

  match(pathname: string): string | undefined {
    const result = this.paths.find(({ path, matcher }) =>
      path === '/'
        ? true // root catches everything
        : matcher?.test(pathname),
    )?.path;

    if (
      process.env.NODE_ENV !== 'production' &&
      result === '/' &&
      pathname !== '/' &&
      pathname.split('/').filter(Boolean).length > 1
    ) {
      // eslint-disable-next-line no-console
      console.warn(
        `[RouteTable] Pathname "${pathname}" fell through to the root "/" catch-all. This may indicate a missing route registration. Registered paths: ${this.paths
          .map(p => p.path)
          .join(', ')}`,
      );
    }

    return result;
  }
}

function compileMatcher(path: string): RegExp {
  const segments = path.split('/').filter(Boolean);
  let pattern = '^';

  for (const segment of segments) {
    if (segment === '*') {
      pattern += '/.+';
    } else if (segment.startsWith(':')) {
      pattern += '/[^/]+';
    } else {
      pattern += `/${escapeRegExp(segment)}`;
    }
  }

  pattern += '(?:/|$)';
  return new RegExp(pattern);
}
