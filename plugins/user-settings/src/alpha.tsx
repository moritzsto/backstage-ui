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
import { type ReactNode, useContext, useRef, useEffect } from 'react';
import {
  coreExtensionData,
  createExtensionInput,
  createFrontendPlugin,
  PageBlueprint,
  NavItemBlueprint,
  SubPageBlueprint,
  RoutingContractContext,
} from '@backstage/frontend-plugin-api';
import {
  createScopedRouter,
  type ScopedRouterResult,
} from '@backstage/plugin-react-router-v7-adapter';
import { Content } from '@backstage/core-components';
import SettingsIcon from '@material-ui/icons/Settings';
import { settingsRouteRef } from './plugin';

import { userSettingsTranslationRef as _userSettingsTranslationRef } from './translation';

/**
 * @alpha
 * @deprecated Import from `@backstage/plugin-user-settings` instead.
 */
export const userSettingsTranslationRef = _userSettingsTranslationRef;

function SettingsAdapterRoot({ children }: { children: ReactNode }) {
  const contract = useContext(RoutingContractContext);
  const scopedRouterRef = useRef<ScopedRouterResult | null>(null);

  useEffect(() => {
    return () => {
      scopedRouterRef.current?.dispose();
      scopedRouterRef.current = null;
    };
  }, [contract]);

  if (!contract) {
    return <>{children}</>;
  }

  if (!scopedRouterRef.current) {
    scopedRouterRef.current = createScopedRouter(contract);
  }

  const scopedRouter = scopedRouterRef.current;

  return <scopedRouter.Router>{children}</scopedRouter.Router>;
}

const userSettingsPage = PageBlueprint.makeWithOverrides({
  factory(originalFactory) {
    const result = originalFactory({
      path: '/settings',
      routeRef: settingsRouteRef,
      title: 'Settings',
    });

    return Array.from(result).map(value =>
      value.id === coreExtensionData.reactElement.id
        ? coreExtensionData.reactElement(
            <SettingsAdapterRoot>{value.value}</SettingsAdapterRoot>,
          )
        : value,
    );
  },
});

const generalSettingsPage = SubPageBlueprint.make({
  name: 'general',
  params: {
    path: 'general',
    title: 'General',
    loader: () =>
      import('./components/General').then(m => (
        <Content>
          <m.UserSettingsGeneral />
        </Content>
      )),
  },
});

const authProvidersSettingsPage = SubPageBlueprint.makeWithOverrides({
  name: 'auth-providers',
  inputs: {
    providerSettings: createExtensionInput([coreExtensionData.reactElement], {
      singleton: true,
      optional: true,
    }),
  },
  factory(originalFactory, { inputs }) {
    return originalFactory({
      path: 'auth-providers',
      title: 'Authentication Providers',
      loader: () =>
        import('./components/AuthProviders').then(m => (
          <Content>
            <m.UserSettingsAuthProviders
              providerSettings={inputs.providerSettings?.get(
                coreExtensionData.reactElement,
              )}
            />
          </Content>
        )),
    });
  },
});

const featureFlagsSettingsPage = SubPageBlueprint.make({
  name: 'feature-flags',
  params: {
    path: 'feature-flags',
    title: 'Feature Flags',
    loader: () =>
      import('./components/FeatureFlags').then(m => (
        <Content>
          <m.UserSettingsFeatureFlags />
        </Content>
      )),
  },
});

/** @alpha */
export const settingsNavItem = NavItemBlueprint.make({
  params: {
    routeRef: settingsRouteRef,
    title: 'Settings',
    icon: SettingsIcon,
  },
});

/**
 * @alpha
 */
export default createFrontendPlugin({
  pluginId: 'user-settings',
  title: 'Settings',
  icon: <SettingsIcon fontSize="inherit" />,
  info: { packageJson: () => import('../package.json') },
  extensions: [
    userSettingsPage,
    generalSettingsPage,
    authProvidersSettingsPage,
    featureFlagsSettingsPage,
    settingsNavItem,
  ],
  routes: {
    root: settingsRouteRef,
  },
});
