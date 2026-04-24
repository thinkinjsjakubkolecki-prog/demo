import type { Routes } from '@angular/router';
import { Component } from '@angular/core';
import {
  DesignerShellComponent,
  ModelDesignerComponent,
  DatasourceDesignerComponent,
  FormDesignerComponent,
  ProcessDesignerComponent,
  MenuEditorComponent,
  ThemeManagerComponent,
  TranslationManagerComponent,
  ExportPanelComponent,
} from '@echelon-framework/designer-widgets';

@Component({ selector: 'r-pages', standalone: true, imports: [DesignerShellComponent], template: '<fx-designer-shell />' })
class R1 {}

@Component({ selector: 'r-models', standalone: true, imports: [ModelDesignerComponent], template: '<fx-model-designer />' })
class R2 {}

@Component({ selector: 'r-ds', standalone: true, imports: [DatasourceDesignerComponent], template: '<fx-datasource-designer />' })
class R3 {}

@Component({ selector: 'r-forms', standalone: true, imports: [FormDesignerComponent], template: '<fx-form-designer />' })
class R4 {}

@Component({ selector: 'r-proc', standalone: true, imports: [ProcessDesignerComponent], template: '<fx-process-designer />' })
class R5 {}

@Component({ selector: 'r-menu', standalone: true, imports: [MenuEditorComponent], template: '<fx-menu-editor />' })
class R6 {}

@Component({ selector: 'r-themes', standalone: true, imports: [ThemeManagerComponent], template: '<fx-theme-manager />' })
class R7 {}

@Component({ selector: 'r-i18n', standalone: true, imports: [TranslationManagerComponent], template: '<fx-translation-manager />' })
class R8 {}

@Component({ selector: 'r-export', standalone: true, imports: [ExportPanelComponent], template: '<fx-export-panel />' })
class R9 {}

@Component({ selector: 'r-draft', standalone: true, template: '<p style="padding:40px;color:#9ca3af">Draft preview</p>' })
class R10 {}

export const routes: Routes = [
  { path: '', redirectTo: '/designer', pathMatch: 'full' },
  { path: 'designer', component: R1, title: 'Pages Designer' },
  { path: 'designer/models', component: R2, title: 'Model Designer' },
  { path: 'designer/datasources', component: R3, title: 'Data Sources' },
  { path: 'designer/forms', component: R4, title: 'Forms Designer' },
  { path: 'designer/processes', component: R5, title: 'Process Designer' },
  { path: 'designer/themes', component: R7, title: 'Theme Manager' },
  { path: 'designer/translations', component: R8, title: 'Translations' },
  { path: 'designer/export', component: R9, title: 'Export' },
  { path: 'menu-editor', component: R6, title: 'Menu Editor' },
  { path: 'draft/:id', component: R10 },
  { path: 'embed/:id', component: R10 },
];
