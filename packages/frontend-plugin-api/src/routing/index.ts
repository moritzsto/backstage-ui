/*
 * Copyright 2020 The Backstage Authors
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

export type { AnyRouteRefParams } from './types';
export { createRouteRef, type RouteRef } from './RouteRef';
export { createSubRouteRef, type SubRouteRef } from './SubRouteRef';
export {
  createExternalRouteRef,
  type ExternalRouteRef,
} from './ExternalRouteRef';
export { useRouteRef } from './useRouteRef';
export { useRouteRefParams } from './useRouteRefParams';
export type { RoutingLocation, RoutingContract } from './RoutingContract';
export type { NavigationControllerApi } from './NavigationControllerApi';
export { navigationControllerApiRef } from './NavigationControllerApi';
export { useFrameworkNavigate } from './useFrameworkNavigate';
export { useFrameworkLocation } from './useFrameworkLocation';
export { RouteLink, type RouteLinkProps } from './RouteLink';
export {
  RoutingContractContext,
  useRoutingContract,
} from './RoutingContractContext';
export {
  NestedRoutingContractProvider,
  useNestedRoutingContract,
  type NestedRoutingContractProviderProps,
  type UseNestedRoutingContractOptions,
} from './NestedRoutingContractProvider';
export {
  useObservableAsState,
  routingLocationEqual,
} from './useObservableAsState';
