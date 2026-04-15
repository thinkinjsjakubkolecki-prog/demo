/**
 * App config — orkiestracja providerów. Konkretne listy (widgety, strony,
 * endpointy, ścieżki) wydzielone do `bootstrap/` żeby ten plik był czytelny.
 */
import { provideHttpClient } from '@angular/common/http';
import { type ApplicationConfig } from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import { provideEchelon } from '@echelon-framework/runtime';
import { coreFunctions } from '@echelon-framework/functions-core';
import { aggregateFunctions } from './bootstrap/aggregate-functions';

import * as fns from './functions';
import * as ds from './datasources';

import { widgets } from './bootstrap/widgets';
import { pages } from './bootstrap/pages';
import { endpoints } from './bootstrap/endpoints';
import { routes } from './bootstrap/routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    // `paramsInheritanceStrategy: always` — child routes (np. taby) widzą
    // params parent route (`:entityId` z `/clients/:entityId`).
    provideRouter(routes, withRouterConfig({ paramsInheritanceStrategy: 'always' })),
    ...provideEchelon({
      widgets,
      functions:   [...coreFunctions, ...aggregateFunctions as never[], ...Object.values(fns)],
      dataSources: Object.values(ds),
      pages,
      endpoints,
    }),
  ],
};
