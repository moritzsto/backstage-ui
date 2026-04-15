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

import type { RoutingContract } from '@backstage/frontend-plugin-api';
import { NavigationController } from './NavigationController';

/**
 * Options for {@link createNestedContracts}.
 *
 * @internal
 */
export interface CreateNestedContractsOptions {
  /** The NavigationController that owns window.history. */
  controller: NavigationController;
  /** The parent extension's base path (e.g. `/catalog`). */
  parentBasePath: string;
  /**
   * Sub-paths relative to the parent base path that need their own
   * routing contracts. For example, `['entities', 'components']` under
   * parent `/catalog` creates contracts for `/catalog/entities` and
   * `/catalog/components`.
   */
  subPaths: string[];
}

/**
 * Pre-creates scoped {@link RoutingContract} instances for nested
 * sub-page extensions that declare routing needs.
 *
 * @remarks
 *
 * This is called during app wiring (in `createSpecializedApp` / tree walk)
 * to build contracts for extensions that declare `needsRoutingContract`.
 * Each contract is scoped to `parentBasePath/subPath` and stored in a map
 * keyed by the sub-path.
 *
 * The returned map is intended to be passed to
 * {@link NestedRoutingContractProvider} so child extensions can retrieve
 * their contracts via `useNestedRoutingContract(subPath)`.
 *
 * @param options - Configuration for nested contract creation.
 * @returns A map of sub-path to pre-created RoutingContract.
 *
 * @internal
 */
export function createNestedContracts(
  options: CreateNestedContractsOptions,
): Map<string, RoutingContract> {
  const { controller, parentBasePath, subPaths } = options;
  const contracts = new Map<string, RoutingContract>();

  for (const subPath of subPaths) {
    const fullBasePath =
      parentBasePath === '/' ? `/${subPath}` : `${parentBasePath}/${subPath}`;
    contracts.set(subPath, controller.createContract(fullBasePath));
  }

  return contracts;
}
