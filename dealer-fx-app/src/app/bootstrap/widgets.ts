/**
 * Lista wszystkich widgetów dostępnych dla `provideEchelon` —
 * generic z `widgets-core` + domenowe (FX-specific) z `app/widgets/`.
 */
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
  ValidatedFormComponent,
  EntityListComponent,
  ContextSidebarComponent,
  SectionHeaderComponent,
  KvListComponent,
  BoolChipsComponent,
} from '@echelon-framework/widgets-core';

import { PageTitleComponent } from '../widgets/page-title.component';
import { StatTileComponent } from '../widgets/stat-tile.component';
import { ClientCardComponent } from '../widgets/client-card.component';
import { PositionRowComponent } from '../widgets/position-row.component';
import { DealerQuoteFormComponent } from '../widgets/dealer-quote-form.component';

export const widgets = [
  // Generic — framework
  DataTableComponent, FilterFormComponent, ActionsBarComponent, EntityHeaderComponent,
  TabStripComponent, PaginationComponent, PageToolbarComponent,
  EditableTableComponent, ProfileFormComponent, ValidatedFormComponent, EntityListComponent, ContextSidebarComponent,
  SectionHeaderComponent, KvListComponent, BoolChipsComponent,
  // Domain — FX dealera
  PageTitleComponent, StatTileComponent, ClientCardComponent,
  PositionRowComponent, DealerQuoteFormComponent,
];
