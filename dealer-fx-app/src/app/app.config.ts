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
  RealClock,
} from '@echelon-framework/runtime';
import { MockTransportAdapter } from '@echelon-framework/transport-mock';
import { HttpTransportAdapter } from '@echelon-framework/transport-http';
import { WsTransportAdapter } from '@echelon-framework/transport-ws';
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
      { path: 'd/:id', component: EchelonPageRouterComponent },
    ]),
    ...provideEchelon({
      // Multi-transport: mock (default, in-memory), http (REST), ws (live feeds).
      // Przełączenie na prawdziwy backend: zmień `kind: "transport", transport: "http", channel: "api/..."` w JSONC.
      transports: {
        mock: new MockTransportAdapter({ clock: new RealClock() }),
        http: new HttpTransportAdapter({ baseUrl: 'http://localhost:3001/api' }),
        ws:   new WsTransportAdapter({ url: 'ws://localhost:3001/ws' }),
      },
      defaultTransport: 'mock',
      widgets: [
        // Generic — z framework, configurable przez JSONC
        DataTableComponent, FilterFormComponent, ActionsBarComponent, EntityHeaderComponent,
        TabStripComponent, PaginationComponent, PageToolbarComponent,
        EditableTableComponent, ProfileFormComponent,
        // Domain — FX-specific dealera
        PageTitleComponent, StatTileComponent, ClientCardComponent,
        PositionRowComponent, DealerQuoteFormComponent,
      ],
      functions:   Object.values(fns),
      dataSources: Object.values(ds),
      pages:       ['clients-admin', 'client-fx', 'client-profile', 'dashboard', 'clients', 'quote', 'positions'],
    }),
  ],
};
