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
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useCallback,
} from 'react';
import { RouteRef } from './RouteRef';
import { useRouteRef } from './useRouteRef';
import { useFrameworkNavigate } from './useFrameworkNavigate';

/**
 * Props for the {@link RouteLink} component.
 *
 * @public
 */
export interface RouteLinkProps {
  routeRef: RouteRef;
  params?: Record<string, string>;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function isModifiedEvent(event: MouseEvent): boolean {
  return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}

/**
 * A component for cross-plugin navigation using route refs.
 *
 * @remarks
 *
 * Resolves a route ref to a URL and renders an anchor tag. On plain clicks,
 * it uses framework navigation for SPA behavior. Modified clicks (meta, ctrl,
 * shift, right-click) are left to the browser for open-in-new-tab behavior.
 *
 * @public
 */
export function RouteLink(props: RouteLinkProps) {
  const { routeRef, params, children, className, style } = props;
  const routeFunc = useRouteRef(routeRef);
  const frameworkNavigate = useFrameworkNavigate();

  // RouteLink accepts untyped params since the route ref's param shape isn't
  // known at the call site. The route function validates params at runtime.
  const href =
    routeFunc?.(params as Parameters<NonNullable<typeof routeFunc>>[0]) ?? '#';

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.button !== 0 || isModifiedEvent(event)) {
        return;
      }

      event.preventDefault();
      frameworkNavigate(href);
    },
    [frameworkNavigate, href],
  );

  return (
    <a href={href} onClick={handleClick} className={className} style={style}>
      {children}
    </a>
  );
}
