/*
 * Copyright 2023 The Backstage Authors
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
import { TemplateExample } from '@backstage/plugin-scaffolder-node';
import * as yaml from 'yaml';

export const examples: TemplateExample[] = [
  {
    description:
      'Retrieve commit comparison information for two commits on GitHub',
    example: yaml.stringify({
      steps: [
        {
          action: 'github:commits:compare',
          name: 'Compare commits',
          input: {
            repoUrl: 'github.com?repo=repo&owner=owner',
            oldCommit: 'release/1.0.0',
            newCommit: 'release/1.0.1',
          },
        },
      ],
    }),
  },
];
