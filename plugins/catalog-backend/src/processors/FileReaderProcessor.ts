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

import fs from 'fs-extra';
import { glob } from 'glob';
import path from 'node:path';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  CatalogProcessor,
  CatalogProcessorEmit,
  CatalogProcessorParser,
  processingResult,
} from '@backstage/plugin-catalog-node';

const LOCATION_TYPE = 'file';

// Detect whether a location target contains any (unescaped) glob
// meta-characters. We use a local helper rather than `glob.hasMagic` so the
// check does not depend on how the default `glob` import is resolved at
// runtime under different module-interop setups.
//
// On POSIX platforms `\` is an escape character, so we strip a backslash
// that immediately precedes a glob meta-character before scanning, to
// match minimatch / glob.hasMagic semantics for literal escaped paths.
//
// On Windows `\` is a path separator, not an escape character — stripping
// `\*` there would drop the `*` from patterns like `C:\dir\*.yaml`
// produced by `path.join`, misclassifying a glob as a concrete path and
// re-introducing the #33326 regression on Windows. We therefore skip the
// strip on platforms where `path.sep === '\\'`.
const GLOB_MAGIC_CHARS = /[*?[\]{}()|!]/;
const BACKSLASH_IS_PATH_SEP = path.sep === '\\';
function isGlobPattern(target: string): boolean {
  const scanned = BACKSLASH_IS_PATH_SEP
    ? target
    : target.replace(/\\[*?[\]{}()|!]/g, '');
  return GLOB_MAGIC_CHARS.test(scanned);
}

/** @public */
export class FileReaderProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'FileReaderProcessor';
  }

  async readLocation(
    location: LocationSpec,
    optional: boolean,
    emit: CatalogProcessorEmit,
    parser: CatalogProcessorParser,
  ): Promise<boolean> {
    if (location.type !== LOCATION_TYPE) {
      return false;
    }

    try {
      const fileMatches = await glob(location.target, {
        windowsPathsNoEscape: true,
      });

      if (fileMatches.length > 0) {
        for (const fileMatch of fileMatches) {
          const data = await fs.readFile(fileMatch);
          const normalizedFilePath = path.normalize(fileMatch);

          // The normalize converts to native slashes; the glob library returns
          // forward slashes even on windows
          for await (const parseResult of parser({
            data: data,
            location: {
              type: LOCATION_TYPE,
              target: normalizedFilePath,
            },
          })) {
            emit(parseResult);
            emit(
              processingResult.refresh(
                `${LOCATION_TYPE}:${normalizedFilePath}`,
              ),
            );
          }
        }
      } else if (!optional && !isGlobPattern(location.target)) {
        // Only emit notFoundError for concrete paths that don't exist.
        // For glob patterns that match zero files we stay silent: emitting
        // notFoundError here caused deferred entities discovered by other
        // targets in the same Location to be dropped by the processing
        // orchestrator (see #33326).
        const message = `${location.type} ${location.target} does not exist`;
        emit(processingResult.notFoundError(location, message));
      }
    } catch (e) {
      const message = `${location.type} ${location.target} could not be read, ${e}`;
      emit(processingResult.generalError(location, message));
    }

    return true;
  }
}
