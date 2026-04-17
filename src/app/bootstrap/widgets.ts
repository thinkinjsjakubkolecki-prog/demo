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
import { CandlestickChartComponent } from '../widgets/candlestick-chart.component';
import { FlowDiagramComponent } from '../widgets/flow-diagram.component';
import { BusinessFlowComponent } from '../widgets/business-flow.component';
import { DesignerShellComponent } from '../widgets/designer-shell.component';
import { MenuEditorComponent } from '../widgets/menu-editor.component';
import { ContainerComponent } from '../widgets/container.component';
import { DatasourceDesignerComponent } from '../widgets/datasource-designer.component';
import { FormDesignerComponent } from '../widgets/form-designer.component';
import { AdvancedFormComponent } from '../widgets/advanced-form.component';
import { ProcessDesignerComponent } from '../widgets/process-designer.component';

export const widgets = [
  // Generic — framework
  DataTableComponent, FilterFormComponent, ActionsBarComponent, EntityHeaderComponent,
  TabStripComponent, PaginationComponent, PageToolbarComponent,
  EditableTableComponent, ProfileFormComponent, ValidatedFormComponent, EntityListComponent, ContextSidebarComponent,
  SectionHeaderComponent, KvListComponent, BoolChipsComponent,
  // Domain — FX dealera
  PageTitleComponent, StatTileComponent, ClientCardComponent,
  PositionRowComponent, DealerQuoteFormComponent,
  // v0.2 rc.15 integracja — chart z ECharts adapter + feature-flag gate
  CandlestickChartComponent,
  // Process Flow Designer demo — mermaid renderer dla dowolnej PageConfig
  FlowDiagramComponent,
  // Business Flow — realne biznesowe procesy z mappingiem na kod
  BusinessFlowComponent,
  // Page Inspector shell — Faza 1 visual designer (M1+)
  DesignerShellComponent,
  // Menu editor — kreator struktury menu (M20)
  MenuEditorComponent,
  // fx-container — widget z children (hierarchia bloczków w bloczkach, M29)
  ContainerComponent,
  // Data Sources Designer — dedykowana sekcja z listą ds + test/snapshot (M30)
  DatasourceDesignerComponent,
  // Forms Designer — dedykowana sekcja z listą form widgetów + placeholder editor (M34)
  FormDesignerComponent,
  // fx-advanced-form — form widget z per-field actions (onChange/onBlur/onFocus) + onSubmit (M37)
  AdvancedFormComponent,
  // Process Designer — dedykowana sekcja z listą procesów + DAG kroków (P5)
  ProcessDesignerComponent,
];
