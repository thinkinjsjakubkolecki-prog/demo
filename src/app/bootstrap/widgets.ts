/**
 * Widgety zarejestrowane w runtime — designery + widgety biznesowe.
 *
 * Aby wygenerowane PageConfig (z DraftProcess) renderowaly sie:
 *  - KAZDY typ widgetu uzywany w extraWidgets musi byc tu.
 *  - Material wrappery wymagaja @angular/material w dependencies dealera —
 *    obecnie pominiete (CRUD example uzywa tylko widgets-core core).
 */
import { designerWidgets } from '@echelon-framework/designer-widgets';
import {
  // widgets-core: data
  DataTableComponent,
  FilterFormComponent,
  EditableTableComponent,
  KvListComponent,
  BoolChipsComponent,
  ProfileFormComponent,
  EntityListComponent,
  // widgets-core: shell / nawigacja
  PageToolbarComponent,
  SectionHeaderComponent,
  ActionsBarComponent,
  PaginationComponent,
  TabStripComponent,
  NavTreeComponent,
  EntityHeaderComponent,
  ContextSidebarComponent,
  // Form Builder — Sprint F3
  FormBuilderComponent,
} from '@echelon-framework/widgets-core';

export const widgets = [
  ...designerWidgets(),

  // ─── widgets-core: data ───
  DataTableComponent,
  FilterFormComponent,
  EditableTableComponent,
  KvListComponent,
  BoolChipsComponent,
  ProfileFormComponent,
  EntityListComponent,

  // ─── widgets-core: shell / nawigacja ───
  PageToolbarComponent,
  SectionHeaderComponent,
  ActionsBarComponent,
  PaginationComponent,
  TabStripComponent,
  NavTreeComponent,
  EntityHeaderComponent,
  ContextSidebarComponent,

  // ─── Form Builder ───
  FormBuilderComponent,
];
