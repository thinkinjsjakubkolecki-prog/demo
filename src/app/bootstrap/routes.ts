import type { Routes } from '@angular/router';
import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  ApplicationDesignerComponent,
  DesignerShellComponent,
  ModelDesignerComponent,
  DatasourceDesignerComponent,
  FormDesignerComponent,
  ProcessDesignerComponent,
  MenuEditorComponent,
  ThemeManagerComponent,
  TranslationManagerComponent,
  ExportPanelComponent,
  PipelineDesignerComponent,
} from '@echelon-framework/designer-widgets';
import { DraftPageStoreService } from '@echelon-framework/designer-core';
import { PageRendererComponent } from '@echelon-framework/runtime';
import { PortFlowDemoComponent } from '../demo/port-flow-demo.component';
import { FormBuilderDemoComponent } from '../demo/form-builder-demo.component';

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

@Component({ selector: 'r-pipelines', standalone: true, imports: [PipelineDesignerComponent], template: '<fx-pipeline-designer />' })
class R11 {}

@Component({ selector: 'r-app-designer', standalone: true, imports: [ApplicationDesignerComponent], template: '<fx-application-designer />' })
class R0 {}

/**
 * Renderer dynamicznych stron — czyta `DraftPageStore` po :id z URL.
 * Match: `page.id === id` lub `page.route.endsWith('/' + id)`.
 */
@Component({
  selector: 'r-draft',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageRendererComponent],
  template: `
    @if (cfg(); as c) {
      <ech-page-renderer [config]="c" />
    } @else {
      <div style="padding:40px;color:#9ca3af">Brak strony "{{ pageId() }}". Sprawdz DraftPageStore lub uzyj Application Designer.</div>
    }
  `,
})
class R10 {
  private readonly route = inject(ActivatedRoute);
  private readonly pageStore = inject(DraftPageStoreService);
  readonly pageId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');
  readonly cfg = computed(() => {
    const id = this.pageId();
    const stored = this.pageStore.all().find((p: any) => p.id === id || p.route?.endsWith('/' + id));
    return (stored as any)?.config ?? null;
  });
}

export const routes: Routes = [
  { path: '', redirectTo: '/designer', pathMatch: 'full' },
  { path: 'designer', component: R0, title: 'Application Designer' },
  { path: 'designer/pages', component: R1, title: 'Pages Designer' },
  { path: 'designer/models', component: R2, title: 'Model Designer' },
  { path: 'designer/datasources', component: R3, title: 'Data Sources' },
  { path: 'designer/forms', component: R4, title: 'Forms Designer' },
  { path: 'designer/processes', component: R5, title: 'Process Designer' },
  { path: 'designer/pipelines', component: R11, title: 'Pipelines' },
  { path: 'designer/themes', component: R7, title: 'Theme Manager' },
  { path: 'designer/translations', component: R8, title: 'Translations' },
  { path: 'designer/export', component: R9, title: 'Export' },
  { path: 'menu-editor', component: R6, title: 'Menu Editor' },
  { path: 'draft/:id', component: R10 },
  { path: 'embed/:id', component: R10 },
  // Demo nowego data flow API (PortSource/PortTarget/transformy)
  { path: 'demo/ports', component: PortFlowDemoComponent, title: 'Port Flow Demo' },
  // Demo Form Builder (Sprint F3)
  { path: 'demo/form-builder', component: FormBuilderDemoComponent, title: 'Form Builder Demo' },
];
