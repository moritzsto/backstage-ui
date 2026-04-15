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

import { render, screen } from '@testing-library/react';
import {
  NestedRoutingContractProvider,
  useNestedRoutingContract,
} from './NestedRoutingContractProvider';
import type { RoutingContract } from './RoutingContract';

function createMockContract(basePath: string): RoutingContract {
  return {
    basePath,
    location$: {
      subscribe: () => ({
        unsubscribe: () => {},
        get closed() {
          return false;
        },
      }),
      [Symbol.observable]() {
        return this;
      },
    },
    navigate: () => {},
  };
}

describe('NestedRoutingContractProvider', () => {
  it('should provide a nested contract by sub-path key', () => {
    const parentContract = createMockContract('/catalog');
    const childContract = createMockContract('/catalog/entities');

    const contracts = new Map<string, RoutingContract>([
      ['entities', childContract],
    ]);

    function Child() {
      const contract = useNestedRoutingContract('entities');
      return (
        <div data-testid="child">basePath: {contract?.basePath ?? 'none'}</div>
      );
    }

    render(
      <NestedRoutingContractProvider
        parentContract={parentContract}
        contracts={contracts}
      >
        <Child />
      </NestedRoutingContractProvider>,
    );

    expect(screen.getByTestId('child')).toHaveTextContent(
      'basePath: /catalog/entities',
    );
  });

  it('should return undefined for an unregistered sub-path', () => {
    const parentContract = createMockContract('/catalog');
    const contracts = new Map<string, RoutingContract>();

    function Child() {
      const contract = useNestedRoutingContract('unknown');
      return (
        <div data-testid="child">
          {contract ? contract.basePath : 'no-contract'}
        </div>
      );
    }

    render(
      <NestedRoutingContractProvider
        parentContract={parentContract}
        contracts={contracts}
      >
        <Child />
      </NestedRoutingContractProvider>,
    );

    expect(screen.getByTestId('child')).toHaveTextContent('no-contract');
  });

  it('should expose the parent contract via the provider', () => {
    const parentContract = createMockContract('/catalog');
    const contracts = new Map<string, RoutingContract>();

    function Child() {
      const contract = useNestedRoutingContract();
      return (
        <div data-testid="child">basePath: {contract?.basePath ?? 'none'}</div>
      );
    }

    render(
      <NestedRoutingContractProvider
        parentContract={parentContract}
        contracts={contracts}
      >
        <Child />
      </NestedRoutingContractProvider>,
    );

    expect(screen.getByTestId('child')).toHaveTextContent('basePath: /catalog');
  });

  it('should throw when used outside of provider with required flag', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    function Child() {
      const contract = useNestedRoutingContract('something', {
        required: true,
      });
      return <div>{contract?.basePath ?? 'none'}</div>;
    }

    expect(() => render(<Child />)).toThrow(
      'useNestedRoutingContract must be used within a NestedRoutingContractProvider',
    );

    consoleError.mockRestore();
  });
});
