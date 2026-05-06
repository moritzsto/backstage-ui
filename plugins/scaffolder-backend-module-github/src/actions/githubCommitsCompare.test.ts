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

import { ConfigReader } from '@backstage/config';
import {
  DefaultGithubCredentialsProvider,
  GithubCredentialsProvider,
  ScmIntegrations,
} from '@backstage/integration';
import { TemplateAction } from '@backstage/plugin-scaffolder-node';
import { createMockActionContext } from '@backstage/plugin-scaffolder-node-test-utils';
import { getOctokitOptions } from '../util';
import { createGithubCommitsCompareAction } from './githubCommitsCompare';

jest.mock('../util', () => {
  return {
    getOctokitOptions: jest.fn(),
  };
});

import { Octokit } from 'octokit';

const octokitMock = Octokit as unknown as jest.Mock;

jest.mock('octokit', () => ({
  Octokit: jest.fn(),
}));

describe('github:commits:compare', () => {
  const config = new ConfigReader({
    integrations: {
      github: [{ host: 'github.com', token: 'tokenlols' }],
    },
  });

  const getOctokitOptionsMock = getOctokitOptions as jest.Mock;
  const integrations = ScmIntegrations.fromConfig(config);

  let githubCredentialsProvider: GithubCredentialsProvider;
  let action: TemplateAction<any, any, any>;

  const mockContext = createMockActionContext({
    input: {
      repoUrl: 'github.com?repo=repo&owner=owner',
      oldCommit: 'release/1.0.0',
      newCommit: 'release/1.0.1',
    },
  });

  beforeEach(() => {
    jest.resetAllMocks();
    octokitMock.mockImplementation(() => ({}));
    getOctokitOptionsMock.mockResolvedValue({ auth: 'tokenlols' });
    githubCredentialsProvider =
      DefaultGithubCredentialsProvider.fromIntegrations(integrations);
    action = createGithubCommitsCompareAction({
      integrations,
      githubCredentialsProvider,
    });
  });

  it('returns two example commits during dry run', async () => {
    await action.handler({
      ...mockContext,
      isDryRun: true,
    });

    expect(mockContext.output).toHaveBeenCalledWith(
      'commits',
      expect.arrayContaining([
        expect.objectContaining({
          sha: expect.any(String),
          commitDate: expect.any(String),
          commitMessage: expect.any(String),
          authorName: expect.any(String),
          authorEmail: expect.any(String),
        }),
        expect.objectContaining({
          sha: expect.any(String),
          commitDate: expect.any(String),
          commitMessage: expect.any(String),
          authorName: expect.any(String),
          authorEmail: expect.any(String),
        }),
      ]),
    );

    const commitsOutputCall = (mockContext.output as jest.Mock).mock.calls.find(
      ([name]) => name === 'commits',
    );

    expect(commitsOutputCall?.[1]).toHaveLength(2);
  });
});
