/**
 * App config — provideEchelon z widgetami z frameworka.
 */
import { provideHttpClient } from '@angular/common/http';
import { type ApplicationConfig } from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import { provideEchelon } from '@echelon-framework/runtime';

import { widgets } from './bootstrap/widgets';
import { routes } from './bootstrap/routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideRouter(routes, withRouterConfig({ paramsInheritanceStrategy: 'always' })),

    ...provideEchelon({
      widgets,
    }),
  ],
};
