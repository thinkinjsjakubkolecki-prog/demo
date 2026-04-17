/**
 * Lista wszystkich widgetów dostępnych dla `provideEchelon` —
 * generic z `widgets-core` + domenowe (FX-specific) + designery z frameworka.
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

import { designerWidgets } from '@echelon-framework/designer-widgets';

import { PageTitleComponent } from '../widgets/page-title.component';
import { StatTileComponent } from '../widgets/stat-tile.component';
import { ClientCardComponent } from '../widgets/client-card.component';
import { PositionRowComponent } from '../widgets/position-row.component';
import { DealerQuoteFormComponent } from '../widgets/dealer-quote-form.component';
import { CandlestickChartComponent } from '../widgets/candlestick-chart.component';
import { FlowDiagramComponent } from '../widgets/flow-diagram.component';
import { BusinessFlowComponent } from '../widgets/business-flow.component';

export const widgets = [
  // Generic — framework widgets-core
  DataTableComponent, FilterFormComponent, ActionsBarComponent, EntityHeaderComponent,
  TabStripComponent, PaginationComponent, PageToolbarComponent,
  EditableTableComponent, ProfileFormComponent, ValidatedFormComponent, EntityListComponent, ContextSidebarComponent,
  SectionHeaderComponent, KvListComponent, BoolChipsComponent,
  // Domain — FX dealera
  PageTitleComponent, StatTileComponent, ClientCardComponent,
  PositionRowComponent, DealerQuoteFormComponent,
  CandlestickChartComponent,
  FlowDiagramComponent,
  BusinessFlowComponent,
  // Designery — framework dostarcza, developer decyduje czy włączyć
  ...designerWidgets(),
];
