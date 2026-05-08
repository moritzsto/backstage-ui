/*
 * Copyright 2025 The Backstage Authors
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

import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { SignInPageBlueprint } from '@backstage/plugin-app-react';
import { ProxiedSignInIdentity, SignInPage } from '@backstage/core-components';
import {
  discoveryApiRef,
  microsoftAuthApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { useEffect } from 'react';
import { useAsync } from '@react-hookz/web';

export type AwsAlbSignInResponse = {
  profile: {
    email: string;
    picture: string;
    displayName: string;
  };
  providerInfo: {
    accessToken: string;
    expiresInSeconds: number;
  };
  backstageIdentity: {
    token: string;
    identity: {
      type: 'user';
      userEntityRef: string;
      ownershipEntityRefs: string[];
    };
    expiresInSeconds: number;
  };
};

const signInPage = SignInPageBlueprint.make({
  params: {
    loader: async () => props => {
      const discoveryApi = useApi(discoveryApiRef);
      const skipSso = new URLSearchParams(window.location.search)
        .has('skip_sso');

      if (skipSso) {
        console.warn('Skipping SSO');
        return (
          <SignInPage
            {...props}
            providers={[
              'guest',
              {
                id: 'microsoft-auth-provider',
                title: 'Microsoft',
                message: 'Sign In using Microsoft Azure AD',
                apiRef: microsoftAuthApiRef,
              },
            ]}
            title="Select a sign-in method"
            align="center"
          />
        );
      }

      const [{ status, error }, { execute }] = useAsync(async () => {
        const identity = new ProxiedSignInIdentity({
          provider: 'awsalb',
          discoveryApi,
        });
    
        await identity.start();
    
        props.onSignInSuccess(identity);
      });

      useEffect(() => {
        if (!skipSso) execute();
      }, [skipSso])

      if (status === 'loading') return <LoaderSpinner />;
      if (error) return <div>{error.message}</div>;

      return null;
    }
  },
})

// const signInPage = SignInPageBlueprint.make({
//   params: {
//     loader: async () => props => {
//       console.log('signInPage loader');

//       const configApi = useApi(configApiRef);

//       const getAuthBaseUrl: () => string = () => {
//         const backendBase = configApi
//           .getString('backend.baseUrl')
//           .replace(/\/$/, '');
//         return `${backendBase}/api/auth`;
//       };

//       const auth = async () => {
//         const baseUrl = getAuthBaseUrl();
//         const response = await fetch(`${baseUrl}/awsalb/refresh`);
//         if (!response.ok) {
//           const error = await response.text()
//           throw new Error(`Auth status: ${response.status} - ${error}`);
//         }
//         return response.json() as Promise<AwsAlbSignInResponse>;
//       };

//       const [error, setError] = useState<string | undefined>();
//       const skipSso = new URLSearchParams(window.location.search).has(
//         'skip_sso',
//       );

//       useEffect(() => {
//         if (skipSso) {
//           console.warn('Skipping SSO');
//           return;
//         }

//         console.info('Requesting AWS ALB sign-in');
//         auth()
//           .then(data => {
//             props.onSignInSuccess(
//               // UserIdentity.createGuest(),
//               UserIdentity.fromLegacy({
//                 userId: data.backstageIdentity.identity.userEntityRef,
//                 profile: data.profile,
//               }),
//             );
//           })
//           .catch(err => {
//             console.error(err);
//             setError(err.message);
//           });
//       }, []);

//       if (skipSso || error)
//         return (
//           <>
//             <SignInPage
//               {...props}
//               providers={[
//                 'guest',
//                 {
//                   id: 'microsoft-auth-provider',
//                   title: 'Microsoft',
//                   message: 'Sign In using Microsoft Azure AD',
//                   apiRef: microsoftAuthApiRef,
//                 },
//               ]}
//               title="Select a sign-in method"
//               align="center"
//             />
//             {error && <div>{error}</div>}
//           </>
//         );

//       return <LoaderSpinner />;
//     },
//   },
// });

/**
 * The default new-frontend sign-in page only enables `guest`. OAuth providers
 * must be listed here so buttons appear; they still require matching
 * `auth.providers` in app-config and the auth backend module.
 *
 * @see https://backstage.io/docs/auth/#sign-in-configuration
 */
export const appModuleSignInPage = createFrontendModule({
  pluginId: 'app',
  extensions: [signInPage],
});

export const LoaderSpinner = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 50 50"
    style={{ display: 'block', margin: 'auto' }}
    aria-label="Loading"
  >
    <circle
      cx="25"
      cy="25"
      r="20"
      fill="none"
      stroke="#1976d2"
      strokeWidth="5"
      strokeDasharray="31.4 94.2"
      strokeLinecap="round"
      transform="rotate(-90 25 25)"
    >
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 25 25"
        to="360 25 25"
        dur="1s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>
);
