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
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactElement,
  type ReactNode,
  useMemo,
} from 'react';
import {
  RoutingContractContext,
  type RoutingContract,
  useObservableAsState,
  routingLocationEqual,
} from '@backstage/frontend-plugin-api';
import { NavigationController } from './NavigationController';
import { RouteTable } from './RouteTable';

class PluginErrorBoundary extends Component<
  { basePath: string; children: ReactNode; fallback: ReactElement },
  { hasError: boolean; error?: Error }
> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  state = { hasError: false, error: undefined };

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(
      `[AppRouteSwitch] Plugin at "${this.props.basePath}" crashed:`,
      error,
      info,
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/** @internal */
export interface AppRouteSwitchProps {
  controller: NavigationController;
  routeTable: RouteTable;
  pages: Map<string, ComponentType>;
  contracts?: Map<string, RoutingContract>;
  fallback: ReactElement;
}

/**
 * Subscribes to NavigationController.location$, matches the current pathname
 * via RouteTable, and renders the matched page extension with a scoped
 * RoutingContract provided via context.
 *
 * Reads from NavigationController.location$ (basename-stripped) rather than
 * window.location directly, ensuring correct behavior with app basename.
 *
 * @internal
 */
export function AppRouteSwitch(props: AppRouteSwitchProps) {
  const { controller, routeTable, pages, contracts, fallback } = props;

  const location = useObservableAsState(
    controller.location$,
    routingLocationEqual,
  );

  const matchedBasePath = routeTable.match(location.pathname);

  // Memoize contract creation per basePath to avoid re-creating on every render
  const contract = useMemo(() => {
    if (!matchedBasePath) {
      return undefined;
    }
    // Use pre-created contract if available
    if (contracts?.has(matchedBasePath)) {
      return contracts.get(matchedBasePath)!;
    }
    return controller.createContract(matchedBasePath);
  }, [matchedBasePath, controller, contracts]);

  if (!matchedBasePath || !contract) {
    return fallback;
  }

  const PageComponent = pages.get(matchedBasePath);
  if (!PageComponent) {
    return fallback;
  }

  return (
    <RoutingContractContext.Provider value={contract}>
      <PluginErrorBoundary
        key={matchedBasePath}
        basePath={matchedBasePath}
        fallback={fallback}
      >
        <PageComponent />
      </PluginErrorBoundary>
    </RoutingContractContext.Provider>
  );
}
