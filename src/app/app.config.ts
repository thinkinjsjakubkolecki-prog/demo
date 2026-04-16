/**
 * App config — orkiestracja providerów. Konkretne listy (widgety, strony,
 * endpointy, ścieżki) wydzielone do `bootstrap/` żeby ten plik był czytelny.
 *
 * Wersja po integracji v0.2 pakietów frameworka:
 *   - feature flags, i18n, telemetry, tenant context podpięte przez DI,
 *   - expression engine udostępniony globalnie (dla computed/when),
 *   - persistence storage gotowa dla draftów formularza.
 */
import { provideHttpClient } from '@angular/common/http';
import { type ApplicationConfig } from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import { provideEchelon } from '@echelon-framework/runtime';
import { coreFunctions } from '@echelon-framework/functions-core';
import { FEATURE_FLAGS, I18N, TELEMETRY, TENANT_CONTEXT, STORAGE } from '@echelon-framework/core';
import { aggregateFunctions } from './bootstrap/aggregate-functions';

import * as fns from './functions';
import * as ds from './datasources';

import { widgets } from './bootstrap/widgets';
import { pages } from './bootstrap/pages';
import { endpoints } from './bootstrap/endpoints';
import { routes } from './bootstrap/routes';
import {
  featureFlags,
  i18n,
  telemetry,
  tenantContext,
  createDraftStorage,
} from './bootstrap/framework-integrations';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    // `paramsInheritanceStrategy: always` — child routes (np. taby) widzą
    // params parent route (`:entityId` z `/clients/:entityId`).
    provideRouter(routes, withRouterConfig({ paramsInheritanceStrategy: 'always' })),

    // Pakiety v0.2 — implementacje serwisów framework-owych
    { provide: FEATURE_FLAGS, useValue: featureFlags },
    { provide: I18N, useValue: i18n },
    { provide: TELEMETRY, useValue: telemetry },
    { provide: TENANT_CONTEXT, useValue: tenantContext },
    { provide: STORAGE, useFactory: () => createDraftStorage() },

    ...provideEchelon({
      widgets,
      functions:   [...coreFunctions, ...aggregateFunctions as never[], ...Object.values(fns)],
      dataSources: Object.values(ds),
      pages,
      endpoints,
    }),
  ],
};
