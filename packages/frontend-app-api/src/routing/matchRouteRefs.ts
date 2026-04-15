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

import { BackstageRouteObject } from './types';
import { escapeRegExp } from './escapeRegExp';

/** @internal */
export interface RouteRefMatch {
  routeObject: BackstageRouteObject;
  pathname: string;
  params: Record<string, string>;
}

/**
 * Converts a route path pattern into a RegExp and extracts parameter names.
 * Handles:
 *  - Named params like `:id`
 *  - Catch-all `*` segments
 *  - Empty path (matches everything as a layout route)
 */
function compilePath(
  pattern: string,
  end: boolean,
): { regexp: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];

  // Empty path matches as a layout/root route
  if (pattern === '') {
    return {
      regexp: new RegExp(end ? '^/$' : '^/'),
      paramNames,
    };
  }

  let regexpSource = '^';

  // Normalize: ensure leading slash, remove trailing slash
  const normalizedPattern = pattern.startsWith('/') ? pattern : `/${pattern}`;
  const segments = normalizedPattern.split('/').filter(Boolean);

  for (const segment of segments) {
    if (segment === '*') {
      paramNames.push('*');
      regexpSource += '/(.+)';
    } else if (segment.startsWith(':')) {
      paramNames.push(segment.slice(1));
      regexpSource += '/([^/]+)';
    } else {
      regexpSource += `/${escapeRegExp(segment)}`;
    }
  }

  if (end) {
    regexpSource += '/?$';
  } else {
    regexpSource += '(?:/|$)';
  }

  return {
    regexp: new RegExp(regexpSource),
    paramNames,
  };
}

function matchPath(
  pattern: string,
  pathname: string,
  end: boolean,
): {
  matched: boolean;
  matchedPathname: string;
  params: Record<string, string>;
} | null {
  const { regexp, paramNames } = compilePath(pattern, end);
  const match = pathname.match(regexp);

  if (!match) {
    return null;
  }

  const matchedPathname = match[0].replace(/\/$/, '') || '/';
  const params: Record<string, string> = {};

  for (let i = 0; i < paramNames.length; i++) {
    const value = match[i + 1];
    if (value !== undefined) {
      params[paramNames[i]] = decodeURIComponent(value);
    }
  }

  return { matched: true, matchedPathname, params };
}

/**
 * Matches a pathname against a tree of BackstageRouteObject route definitions.
 *
 * This is a framework-agnostic replacement for react-router's `matchRoutes`.
 * Returns an array of matches from root to most specific, or null if no match.
 *
 * Each match's `pathname` is the full accumulated path from root to that node,
 * matching react-router's `matchRoutes` behavior.
 *
 * @internal
 */
export function matchRouteRefs(
  routes: BackstageRouteObject[],
  pathname: string,
): RouteRefMatch[] | null {
  const matches: RouteRefMatch[] = [];
  matchRouteBranch(routes, pathname, '', matches);
  return matches.length > 0 ? matches : null;
}

function joinPathSegments(base: string, segment: string): string {
  if (segment === '/') {
    return base || '/';
  }
  const joined = base + segment;
  return joined || '/';
}

/**
 * Compute a priority score for route sorting.
 * Higher score = more specific = tried first.
 */
function routePriority(route: BackstageRouteObject): number {
  const path = route.path;
  if (path === '*') return 0; // catch-all is lowest priority
  if (path === '') return 1; // layout/root route is low priority
  // Count static and param segments — static segments are worth more
  const segments = path.replace(/^\//, '').split('/').filter(Boolean);
  let score = 2;
  for (const seg of segments) {
    if (seg === '*') return 1;
    score += seg.startsWith(':') ? 1 : 2;
  }
  return score;
}

function matchRouteBranch(
  routes: BackstageRouteObject[],
  remainingPathname: string,
  parentPathname: string,
  matches: RouteRefMatch[],
): boolean {
  // Sort routes by specificity: most specific first, splat/empty last
  const sorted = [...routes].sort(
    (a, b) => routePriority(b) - routePriority(a),
  );

  for (const route of sorted) {
    const hasChildren = route.children && route.children.length > 0;

    if (hasChildren) {
      const partialResult = matchPath(route.path, remainingPathname, false);
      if (partialResult) {
        const savedLength = matches.length;
        const fullPathname = joinPathSegments(
          parentPathname,
          partialResult.matchedPathname,
        );
        matches.push({
          routeObject: route,
          pathname: fullPathname,
          params: partialResult.params,
        });

        let childRemaining = remainingPathname;
        if (partialResult.matchedPathname !== '/') {
          childRemaining = remainingPathname.slice(
            partialResult.matchedPathname.length,
          );
          if (!childRemaining.startsWith('/')) {
            childRemaining = `/${childRemaining}`;
          }
        }

        if (
          matchRouteBranch(
            route.children!,
            childRemaining,
            fullPathname,
            matches,
          )
        ) {
          return true;
        }

        // Children didn't match; check if this route itself is an exact match
        matches.length = savedLength;
        const exactResult = matchPath(route.path, remainingPathname, true);
        if (exactResult) {
          matches.push({
            routeObject: route,
            pathname: joinPathSegments(
              parentPathname,
              exactResult.matchedPathname,
            ),
            params: exactResult.params,
          });
          return true;
        }
      }
    } else {
      const result = matchPath(route.path, remainingPathname, true);
      if (result) {
        matches.push({
          routeObject: route,
          pathname: joinPathSegments(parentPathname, result.matchedPathname),
          params: result.params,
        });
        return true;
      }
    }
  }

  return false;
}
