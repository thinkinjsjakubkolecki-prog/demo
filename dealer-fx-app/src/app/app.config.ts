/**
 * App config — orkiestracja providerów. Konkretne listy (widgety, strony,
 * endpointy, ścieżki) wydzielone do `bootstrap/` żeby ten plik był czytelny.
 */
import { provideHttpClient } from '@angular/common/http';
import { type ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideEchelon } from '@echelon-framework/runtime';
import { coreFunctions } from '@echelon-framework/functions-core';

import * as fns from './functions';
import * as ds from './datasources';

import { widgets } from './bootstrap/widgets';
import { pages } from './bootstrap/pages';
import { endpoints } from './bootstrap/endpoints';
import { routes } from './bootstrap/routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideRouter(routes),
    ...provideEchelon({
      widgets,
      functions:   [...coreFunctions, ...Object.values(fns)],
      dataSources: Object.values(ds),
      pages,
      endpoints,
    }),
  ],
};
