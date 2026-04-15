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

import { createContext, useContext, type ReactNode } from 'react';
import { getOrCreateGlobalSingleton } from '@backstage/version-bridge';
import type { RoutingContract } from './RoutingContract';

/**
 * Internal context value for nested routing contract provisioning.
 */
interface NestedRoutingContractContextValue {
  /** The parent contract that owns the base path for this subtree. */
  parentContract: RoutingContract;
  /** Pre-created contracts keyed by sub-path (relative to parent basePath). */
  contracts: Map<string, RoutingContract>;
}

const NestedRoutingContractCtx = getOrCreateGlobalSingleton(
  'nested-routing-contract-context',
  () => createContext<NestedRoutingContractContextValue | undefined>(undefined),
);

/**
 * Props for {@link NestedRoutingContractProvider}.
 *
 * @public
 */
export interface NestedRoutingContractProviderProps {
  /** The parent plugin's routing contract. */
  parentContract: RoutingContract;
  /**
   * Pre-created contracts for nested sub-paths, keyed by the sub-path
   * relative to the parent's basePath. For example, if the parent has
   * basePath `/catalog`, a nested contract for `/catalog/entities`
   * would be keyed as `entities`.
   */
  contracts: Map<string, RoutingContract>;
  children: ReactNode;
}

/**
 * Provides pre-created nested routing contracts to sub-page extensions
 * that need their own scoped routing.
 *
 * @remarks
 *
 * This component is used by plugins that render child plugins or sub-page
 * extensions at sub-routes. Each child extension that needs its own
 * routing context can retrieve a pre-created contract via
 * {@link useNestedRoutingContract}.
 *
 * @example
 *
 * ```tsx
 * // In a parent plugin that hosts child extensions at sub-routes
 * <NestedRoutingContractProvider
 *   parentContract={myContract}
 *   contracts={nestedContracts}
 * >
 *   <ChildExtensionOutlet />
 * </NestedRoutingContractProvider>
 * ```
 *
 * @public
 */
export function NestedRoutingContractProvider(
  props: NestedRoutingContractProviderProps,
) {
  const { parentContract, contracts, children } = props;

  return (
    <NestedRoutingContractCtx.Provider value={{ parentContract, contracts }}>
      {children}
    </NestedRoutingContractCtx.Provider>
  );
}

/**
 * Options for {@link useNestedRoutingContract}.
 *
 * @public
 */
export interface UseNestedRoutingContractOptions {
  /**
   * When true, throws an error if the hook is used outside of a
   * {@link NestedRoutingContractProvider}. Defaults to false.
   */
  required?: boolean;
}

/**
 * Retrieves a pre-created nested routing contract for a sub-path.
 *
 * @remarks
 *
 * When called without a `subPath`, returns the parent contract.
 * When called with a `subPath`, returns the pre-created contract for
 * that sub-path, or `undefined` if no contract was registered for it.
 *
 * @param subPath - The sub-path key to look up (relative to parent basePath).
 *   If omitted, returns the parent contract.
 * @param options - Options controlling behavior.
 * @returns The matching routing contract, or undefined if not found.
 *
 * @public
 */
export function useNestedRoutingContract(
  subPath?: string,
  options?: UseNestedRoutingContractOptions,
): RoutingContract | undefined {
  const ctx = useContext(NestedRoutingContractCtx);

  if (!ctx) {
    if (options?.required) {
      throw new Error(
        'useNestedRoutingContract must be used within a NestedRoutingContractProvider',
      );
    }
    return undefined;
  }

  if (subPath === undefined) {
    return ctx.parentContract;
  }

  return ctx.contracts.get(subPath);
}
