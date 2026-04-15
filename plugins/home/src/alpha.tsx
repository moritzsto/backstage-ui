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

/**
 * The home plugin for Backstage's new frontend system.
 *
 * @remarks
 * This package provides the new frontend system implementation of the home plugin,
 * which offers customizable home pages with widget support and optional visit tracking.
 *
 * @packageDocumentation
 */

import {
  type ReactNode,
  lazy as reactLazy,
  useContext,
  useRef,
  useEffect,
} from 'react';
import {
  createExtensionInput,
  PageBlueprint,
  NavItemBlueprint,
  createFrontendPlugin,
  createRouteRef,
  AppRootElementBlueprint,
  identityApiRef,
  storageApiRef,
  errorApiRef,
  ApiBlueprint,
  ExtensionBoundary,
  RoutingContractContext,
} from '@backstage/frontend-plugin-api';
import { VisitListener } from './components/';
import { visitsApiRef, VisitsStorageApi, VisitsWebStorageApi } from './api';
import HomeIcon from '@material-ui/icons/Home';
import {
  homePageWidgetDataRef,
  homePageLayoutComponentDataRef,
  HomePageLayoutBlueprint,
  HomePageWidgetBlueprint,
  type HomePageLayoutProps,
} from '@backstage/plugin-home-react/alpha';
import {
  createScopedRouter,
  type TanStackScopedRouterResult,
} from '@backstage/plugin-tanstack-router-adapter';

const rootRouteRef = createRouteRef();

/**
 * Adapter root for TanStack Router integration.
 *
 * Uses the TanStack adapter's `Router` component which renders children inside
 * the TanStack router context via a root route component. This allows children
 * to use TanStack routing hooks (useNavigate, useParams, etc.).
 *
 * @internal
 */
function HomeAdapterRoot({ children }: { children: ReactNode }) {
  const contract = useContext(RoutingContractContext);
  const scopedRouterRef = useRef<TanStackScopedRouterResult | null>(null);

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

  return (
    <scopedRouterRef.current.Router>{children}</scopedRouterRef.current.Router>
  );
}

const homePage = PageBlueprint.makeWithOverrides({
  inputs: {
    widgets: createExtensionInput([homePageWidgetDataRef]),
    layout: createExtensionInput([HomePageLayoutBlueprint.dataRefs.component], {
      singleton: true,
      optional: true,
      internal: true,
    }),
  },
  factory(originalFactory, { node, inputs }) {
    return originalFactory({
      path: '/home',
      noHeader: true,
      routeRef: rootRouteRef,
      loader: async () => {
        const LazyDefaultLayout = reactLazy(() =>
          import('./alpha/DefaultHomePageLayout').then(m => ({
            default: m.DefaultHomePageLayout,
          })),
        );

        const DefaultLayoutComponent = (props: HomePageLayoutProps) => (
          <ExtensionBoundary node={node}>
            <LazyDefaultLayout {...props} />
          </ExtensionBoundary>
        );

        const Layout =
          inputs.layout?.get(homePageLayoutComponentDataRef) ??
          DefaultLayoutComponent;

        const widgets = inputs.widgets.map(widget => ({
          ...widget.get(homePageWidgetDataRef),
          node: widget.node,
        }));

        return (
          <HomeAdapterRoot>
            <Layout widgets={widgets} />
          </HomeAdapterRoot>
        );
      },
    });
  },
});

const visitListenerAppRootElement = AppRootElementBlueprint.make({
  name: 'visit-listener',
  disabled: true,
  params: {
    element: <VisitListener />,
  },
});

const visitsApi = ApiBlueprint.make({
  name: 'visits',
  disabled: true,
  params: defineParams =>
    defineParams({
      api: visitsApiRef,
      deps: {
        storageApi: storageApiRef,
        identityApi: identityApiRef,
        errorApi: errorApiRef,
      },
      factory: ({ storageApi, identityApi, errorApi }) => {
        // Smart fallback: use custom storage API if available, otherwise localStorage
        if (storageApi) {
          return VisitsStorageApi.create({ storageApi, identityApi });
        }
        return VisitsWebStorageApi.create({ identityApi, errorApi });
      },
    }),
});

const homeNavItem = NavItemBlueprint.make({
  params: {
    title: 'Home',
    routeRef: rootRouteRef,
    icon: HomeIcon,
  },
});

const homePageToolkitWidget = HomePageWidgetBlueprint.make({
  name: 'toolkit',
  params: {
    name: 'HomePageToolkit',
    title: 'Toolkit',
    components: () =>
      import('./homePageComponents/Toolkit').then(m => ({
        Content: m.Content,
        ContextProvider: m.ContextProvider,
      })),
    componentProps: {
      tools: [
        {
          url: 'https://backstage.io',
          label: 'Backstage Docs',
          icon: <HomeIcon />,
        },
      ],
    },
  },
});

const homePageStarredEntitiesWidget = HomePageWidgetBlueprint.make({
  name: 'starred-entities',
  params: {
    name: 'HomePageStarredEntities',
    title: 'Your Starred Entities',
    components: () =>
      import('./homePageComponents/StarredEntities').then(m => ({
        Content: m.Content,
      })),
  },
});

const homePageRandomJokeWidget = HomePageWidgetBlueprint.make({
  name: 'random-joke',
  params: {
    name: 'HomePageRandomJoke',
    title: 'Random Joke',
    description: 'Shows a random programming joke',
    components: () =>
      import('./homePageComponents/RandomJoke').then(m => ({
        Content: m.Content,
        Settings: m.Settings,
        Actions: m.Actions,
        ContextProvider: m.ContextProvider,
      })),
    layout: {
      height: { minRows: 4 },
      width: { minColumns: 3 },
    },
    settings: {
      schema: {
        title: 'Random Joke settings',
        type: 'object',
        properties: {
          defaultCategory: {
            title: 'Category',
            type: 'string',
            enum: ['any', 'programming', 'dad'],
            default: 'any',
          },
        },
      },
    },
  },
});

/**
 * Home plugin for the new frontend system.
 *
 * Provides core homepage functionality with optional visit tracking extensions.
 * Visit tracking extensions are disabled by default and can be enabled via app-config.yaml.
 *
 * @alpha
 */
export default createFrontendPlugin({
  pluginId: 'home',
  title: 'Home',
  icon: <HomeIcon />,
  info: { packageJson: () => import('../package.json') },
  extensions: [
    homePage,
    homeNavItem,
    visitsApi,
    visitListenerAppRootElement,
    homePageToolkitWidget,
    homePageStarredEntitiesWidget,
    homePageRandomJokeWidget,
  ],
  routes: {
    root: rootRouteRef,
  },
});

import { homeTranslationRef as _homeTranslationRef } from './translation';

/**
 * @alpha
 * @deprecated Import from `@backstage/plugin-home` instead.
 */
export const homeTranslationRef = _homeTranslationRef;
