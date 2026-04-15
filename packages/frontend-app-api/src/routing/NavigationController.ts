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

import type {
  RoutingContract,
  RoutingLocation,
} from '@backstage/frontend-plugin-api';
import type { Observable, Subscription } from '@backstage/types';

type LocationHandler = (location: RoutingLocation) => void;

/**
 * NavigationController owns window.history and provides scoped
 * RoutingContract instances to plugins.
 *
 * The location$ observable never signals error or complete — it represents
 * a continuous location stream that lives for the duration of the app.
 * Calling dispose() stops emissions but does not signal complete to observers.
 *
 * @internal
 */
export class NavigationController {
  private readonly basename: string;
  private readonly subscribers: Set<LocationHandler> = new Set();
  private readonly popstateHandler: () => void;

  constructor(options?: { basename?: string }) {
    this.basename = options?.basename ?? '';

    this.popstateHandler = () => {
      this.emit();
    };

    window.addEventListener('popstate', this.popstateHandler);
  }

  /** Observable of the current location (basename-stripped). */
  readonly location$: Observable<RoutingLocation> = {
    subscribe: (
      observerOrOnNext?:
        | { next?: (value: RoutingLocation) => void }
        | ((value: RoutingLocation) => void),
      _onError?: (error: Error) => void,
      _onComplete?: () => void,
    ): Subscription => {
      let isClosed = false;
      const onNext =
        typeof observerOrOnNext === 'function'
          ? observerOrOnNext
          : observerOrOnNext?.next?.bind(observerOrOnNext);

      const handler: LocationHandler = (loc: RoutingLocation) => {
        if (!isClosed && onNext) {
          onNext(loc);
        }
      };

      this.subscribers.add(handler);

      // Emit current location immediately on subscribe
      handler(this.getCurrentLocation());

      return {
        unsubscribe: () => {
          isClosed = true;
          this.subscribers.delete(handler);
        },
        get closed() {
          return isClosed;
        },
      };
    },
    [Symbol.observable]() {
      return this;
    },
  };

  /** Navigate to a path (relative to the app root, not basename). */
  navigate(to: string, options?: { replace?: boolean; state?: unknown }): void {
    if (to.includes('://')) {
      throw new Error(
        'NavigationController.navigate does not support absolute URLs',
      );
    }
    const url = new URL(to, window.location.origin);
    const fullPath = this.basename + url.pathname + url.search + url.hash;
    const historyState = options?.state ?? null;

    if (options?.replace) {
      window.history.replaceState(historyState, '', fullPath);
    } else {
      window.history.pushState(historyState, '', fullPath);
    }

    // Emit directly rather than dispatching a synthetic popstate event.
    // popstate should only fire for real browser back/forward navigation.
    this.emit();
  }

  /** Create a scoped RoutingContract for a plugin basePath. */
  createContract(basePath: string): RoutingContract {
    const addSubscriber = (h: LocationHandler) => this.subscribers.add(h);
    const removeSubscriber = (h: LocationHandler) => this.subscribers.delete(h);
    const getLocation = () => this.getCurrentLocation();
    const doNavigate = (
      to: string,
      opts?: { replace?: boolean; state?: unknown },
    ) => this.navigate(to, opts);

    const contractLocation$: Observable<RoutingLocation> = {
      subscribe: (
        observerOrOnNext?:
          | { next?: (value: RoutingLocation) => void }
          | ((value: RoutingLocation) => void),
        _onError?: (error: Error) => void,
        _onComplete?: () => void,
      ): Subscription => {
        let isClosed = false;
        const onNext =
          typeof observerOrOnNext === 'function'
            ? observerOrOnNext
            : observerOrOnNext?.next?.bind(observerOrOnNext);

        const handler: LocationHandler = (loc: RoutingLocation) => {
          if (isClosed || !onNext) {
            return;
          }

          const isRoot = basePath === '/';
          if (
            isRoot ||
            loc.pathname === basePath ||
            loc.pathname.startsWith(`${basePath}/`)
          ) {
            const scopedPathname = isRoot
              ? loc.pathname
              : loc.pathname.slice(basePath.length) || '/';
            onNext({
              pathname: scopedPathname,
              search: loc.search,
              hash: loc.hash,
              state: loc.state,
            });
          }
        };

        addSubscriber(handler);

        // Emit current location immediately if it matches
        handler(getLocation());

        return {
          unsubscribe: () => {
            isClosed = true;
            removeSubscriber(handler);
          },
          get closed() {
            return isClosed;
          },
        };
      },
      [Symbol.observable]() {
        return this;
      },
    };

    return {
      basePath,
      location$: contractLocation$,
      navigate: (
        to: string,
        options?: { replace?: boolean; state?: unknown },
      ): void => {
        // Join basePath + to, then normalize using URL resolution
        const joined = basePath === '/' ? to : `${basePath}${to}`;
        const resolvedUrl = new URL(joined, window.location.origin);
        const resolvedPath = resolvedUrl.pathname;

        // Check if the resolved path is within the basePath scope
        const isRoot = basePath === '/';
        if (
          !isRoot &&
          resolvedPath !== basePath &&
          !resolvedPath.startsWith(`${basePath}/`)
        ) {
          // eslint-disable-next-line no-console
          console.warn(
            `[NavigationController] Contract navigate called with path "${to}" ` +
              `that resolves outside basePath "${basePath}". Navigation blocked. ` +
              `For cross-plugin navigation, use <RouteLink> from @backstage/frontend-plugin-api ` +
              `or useFrameworkNavigate() instead of react-router's <Link> or useNavigate().`,
          );
          return;
        }

        doNavigate(
          resolvedPath + resolvedUrl.search + resolvedUrl.hash,
          options,
        );
      },
    };
  }

  /** Stop listening to popstate events and clear all subscribers. */
  dispose(): void {
    window.removeEventListener('popstate', this.popstateHandler);
    this.subscribers.clear();
  }

  private getCurrentLocation(): RoutingLocation {
    const pathname = this.stripBasename(window.location.pathname);
    return {
      pathname,
      search: window.location.search,
      hash: window.location.hash,
      state: window.history.state,
    };
  }

  private stripBasename(pathname: string): string {
    if (this.basename && pathname.startsWith(this.basename)) {
      return pathname.slice(this.basename.length) || '/';
    }
    return pathname;
  }

  private emit(): void {
    const location = this.getCurrentLocation();
    const handlers = [...this.subscribers];
    for (const handler of handlers) {
      handler(location);
    }
  }
}
