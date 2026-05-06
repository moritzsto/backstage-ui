/*
 * Copyright 2021 The Backstage Authors
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
  GithubCredentialsProvider,
  ScmIntegrationRegistry,
} from '@backstage/integration';
import {
  createTemplateAction,
  parseRepoUrl,
} from '@backstage/plugin-scaffolder-node';
import { InputError, toError } from '@backstage/errors';
import { Octokit } from 'octokit';
import { Endpoints } from '@octokit/types';
import { getOctokitOptions } from '../util';
import { examples } from './githubCommitsCompare.examples';

/**
 * Compares commits on GitHub
 * @public
 */
export function createGithubCommitsCompareAction(options: {
  integrations: ScmIntegrationRegistry;
  githubCredentialsProvider?: GithubCredentialsProvider;
}) {
  const { integrations, githubCredentialsProvider } = options;

  return createTemplateAction({
    id: 'github:commits:compare',
    description: 'Compares commits on GitHub.',
    examples,
    supportsDryRun: true,
    schema: {
      input: {
        repoUrl: z =>
          z.string({
            description:
              'Accepts the format `github.com?repo=reponame&owner=owner` where `reponame` is the repository name and `owner` is an organization or username',
          }),
        oldCommit: z =>
          z.string({
            description: 'The SHA or branch name of the old commit',
          }),
        newCommit: z =>
          z.string({
            description: 'The SHA or branch name of the new commit',
          }),
        token: z =>
          z
            .string({
              description:
                'The `GITHUB_TOKEN` to use for authorization to GitHub',
            })
            .optional(),
      },
      output: {
        commits: z =>
          z.array(
            z.object({
              sha: z.string({
                description: 'The SHA of the commit',
              }),
              commitDate: z.string({
                description: 'The date of the commit',
              }),
              commitMessage: z.string({
                description: 'The first line of the commit message',
              }),
              pullRequestNumber: z
                .number({
                  description:
                    'The pull request number associated with the commit, if any',
                })
                .optional(),
              authorName: z.string({
                description: 'The name of the commit author',
              }),
              authorEmail: z.string({
                description: 'The email of the commit author',
              }),
            }),
          ),
      },
    },
    async handler(ctx) {
      const { repoUrl, oldCommit, newCommit, token: providedToken } = ctx.input;

      const { host, owner, repo } = parseRepoUrl(repoUrl, integrations);
      ctx.logger.info(
        `Comparing commits "${oldCommit}" and "${newCommit}" on repo ${repo}`,
      );

      if (!owner) {
        throw new InputError('Invalid repository owner provided in repoUrl');
      }

      const octokitOptions = await getOctokitOptions({
        integrations,
        credentialsProvider: githubCredentialsProvider,
        host,
        owner,
        repo,
        token: providedToken,
      });

      const client = new Octokit({
        ...octokitOptions,
        log: ctx.logger,
      });

      if (ctx.isDryRun) {
        ctx.logger.info(
          `Performing dry run of comparing commits "${oldCommit}" and "${newCommit}"`,
        );
        ctx.output('commits', [
          {
            sha: 'b7fd1f4e5e9b4c4e2e7f5f7d9d8c6a5b4e3d2c1a',
            commitDate: '2026-04-15T09:30:00Z',
            commitMessage:
              'feat: Add scaffolder dry-run comparison example (#9)',
            pullRequestNumber: 9,
            authorName: 'Backstage User',
            authorEmail: 'user@website.example',
          },
          {
            sha: 'c8ae2a5d6f0c5d5f3f8a6e8c0b9d7e6f5a4b3c2d',
            commitDate: '2026-04-15T10:15:00Z',
            commitMessage: 'fix: Update commit comparison output sample (#10)',
            pullRequestNumber: 10,
            authorName: 'Backstage User',
            authorEmail: 'user@website.example',
          },
        ]);
        ctx.logger.info(`Dry run complete`);
        return;
      }

      try {
        type CompareData =
          Endpoints['GET /repos/{owner}/{repo}/compare/{basehead}']['response']['data'];
        const basehead = `${oldCommit}...${newCommit}`;
        const comparison = await ctx.checkpoint({
          key: `github.repos.compare.${owner}.${repo}.${basehead}`,
          fn: async () => {
            const pullRequestRegex = /(#[0-9]+)/;

            const allCommits = await client.paginate(
              client.rest.repos.compareCommitsWithBasehead,
              {
                owner,
                repo,
                basehead,
                per_page: 100,
              },
              response =>
                (response.data as unknown as CompareData).commits.map(
                  commit => ({
                    sha: commit.sha,
                    commitDate:
                      commit.commit.author?.date ??
                      commit.commit.committer?.date ??
                      '',
                    commitMessage: commit.commit.message.includes('\r\n')
                      ? commit.commit.message.split('\r\n')[0]
                      : commit.commit.message.split('\n')[0],
                    pullRequestNumber: (() => {
                      const prNumber =
                        commit.commit.message.match(pullRequestRegex)?.[1];
                      return prNumber
                        ? parseInt(prNumber.replace('#', ''), 10)
                        : undefined;
                    })(),
                    authorName:
                      commit.commit.author?.name ??
                      commit.commit.committer?.name ??
                      '',
                    authorEmail:
                      commit.commit.author?.email ??
                      commit.commit.committer?.email ??
                      '',
                  }),
                ),
            );

            return { commits: allCommits };
          },
        });

        if (!comparison) {
          throw new Error('Failed to retrieve commit comparison from GitHub');
        }

        ctx.output('commits', comparison.commits);

        ctx.logger.info(
          `Successfully compared commits "${oldCommit}" and "${newCommit}" on repo ${repo}`,
        );
      } catch (e) {
        const error = toError(e);
        ctx.logger.warn(
          `Failed: comparing commits "${oldCommit}" and "${newCommit}" on repo '${repo}', ${error.message}`,
        );
        throw error;
      }
    },
  });
}
