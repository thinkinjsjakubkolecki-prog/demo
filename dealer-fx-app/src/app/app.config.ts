/**
 * App config — single call do `provideEchelon()`.
 *
 * Wszystko deklaratywne, wszystko klasy z dekoratorem:
 *  - widgets:     `@EchelonWidget` (5 domain) + 8 generic z @echelon-framework/widgets-core
 *  - functions:   `@PureFunction`/`@Validator`/`@Formatter`
 *  - dataSources: `@DataSource` (Static/Stream)
 *  - pages:       lista plików JSONC z `/assets/pages/`
 */
import { provideHttpClient } from '@angular/common/http';
import { type ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideEchelon,
  EchelonPageRouterComponent,
} from '@echelon-framework/runtime';
import { coreFunctions } from '@echelon-framework/functions-core';
import { clientsAdminPage } from './pages/clients-admin.page';
import { clientProfilePage } from './pages/client-profile.page';
import {
  DataTableComponent,
  FilterFormComponent,
  ActionsBarComponent,
  EntityHeaderComponent,
  TabStripComponent,
  PaginationComponent,
  PageToolbarComponent,
  EditableTableComponent,
  ProfileFormComponent,
  EntityListComponent,
  ContextSidebarComponent,
} from '@echelon-framework/widgets-core';

import * as fns from './functions';
import * as ds from './datasources';
// Domain widgets (FX-specific)
import { PageTitleComponent } from './widgets/page-title.component';
import { StatTileComponent } from './widgets/stat-tile.component';
import { ClientCardComponent } from './widgets/client-card.component';
import { PositionRowComponent } from './widgets/position-row.component';
import { DealerQuoteFormComponent } from './widgets/dealer-quote-form.component';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideRouter([
      { path: '', redirectTo: '/d/clients-admin', pathMatch: 'full' },
      { path: 'd/:id/:entityId', component: EchelonPageRouterComponent },
      { path: 'd/:id', component: EchelonPageRouterComponent },
    ]),
    ...provideEchelon({
      // transports: nieustawione → framework tworzy default mock i ładuje fixtures.
      // HTTP/WS adaptery są zainstalowane i gotowe, ale framework obecnie nie
      // pozwala mieszać custom transports z automatycznym fixture loaderem.
      // Podepniemy je po framework rc.14 (per-action transport w fetch handler).
      widgets: [
        // Generic — z framework, configurable przez JSONC
        DataTableComponent, FilterFormComponent, ActionsBarComponent, EntityHeaderComponent,
        TabStripComponent, PaginationComponent, PageToolbarComponent,
        EditableTableComponent, ProfileFormComponent, EntityListComponent, ContextSidebarComponent,
        // Domain — FX-specific dealera
        PageTitleComponent, StatTileComponent, ClientCardComponent,
        PositionRowComponent, DealerQuoteFormComponent,
      ],
      functions:   [...coreFunctions, ...Object.values(fns)],
      dataSources: Object.values(ds),
      pages:       [
        clientsAdminPage,        // built via defineEntityListPage
        clientProfilePage,       // built via defineDetailPage
        'client-fx', 'dashboard', 'clients', 'quote', 'positions',
      ],
      endpoints: {
        // GET-like resolver: zwraca pojedynczego klienta po `code`.
        // Dane czerpie z fixture `clientsList` ładowanego przez @DataSource(Static).
        'client-by-id': async (params: Record<string, unknown>) => {
          const code = String(params['id'] ?? '');
          const res = await fetch('/assets/fixtures/clients.json');
          const all = (await res.json()) as Array<Record<string, unknown>>;
          return all.find((c) => c['code'] === code) ?? null;
        },
      },
    }),
  ],
};
