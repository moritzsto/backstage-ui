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

import fs from 'node:fs';
import path from 'node:path';

const linkSource = fs.readFileSync(
  path.resolve(__dirname, './Link.tsx'),
  'utf8',
);

describe('Link.tsx type imports', () => {
  it('imports RoutingContract and NavigationControllerApi from frontend-plugin-api', () => {
    expect(linkSource).toContain("from '@backstage/frontend-plugin-api';");
    expect(linkSource).toMatch(
      /import type \{[\s\S]*RoutingContract[\s\S]*\} from '@backstage\/frontend-plugin-api';/,
    );
    expect(linkSource).toMatch(
      /import type \{[\s\S]*NavigationControllerApi[\s\S]*\} from '@backstage\/frontend-plugin-api';/,
    );
  });

  it('does not redeclare RoutingContract or NavigationControllerApi locally', () => {
    expect(linkSource).not.toMatch(/\binterface RoutingContract\b/);
    expect(linkSource).not.toMatch(/\binterface NavigationControllerApi\b/);
  });
});
