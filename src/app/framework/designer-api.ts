/**
 * API publiczne — funkcje które apka importuje i jawnie używa.
 * Framework dostarcza. Developer decyduje.
 */
import type { Type } from '@angular/core';
import type { CanActivateFn, Routes } from '@angular/router';

import { ModelDesignerComponent } from './model-designer.component';
import { FormDesignerComponent } from './form-designer.component';
import { DatasourceDesignerComponent } from './datasource-designer.component';
import { ProcessDesignerComponent } from './process-designer.component';
import { MenuEditorComponent } from './menu-editor.component';
import { DesignerShellComponent } from './designer-shell.component';
import { FormRefComponent } from './form-ref.component';
import { AdvancedFormComponent } from './advanced-form.component';
import { ContainerComponent } from './container.component';
import { ExportPanelComponent } from './export-panel.component';
import { TranslationManagerComponent } from './translation-manager.component';

/**
 * Zwraca listę WSZYSTKICH widget-ów designera do rejestracji w provideEchelon.
 *
 * ```ts
 * provideEchelon({ widgets: [...myWidgets, ...designerWidgets()] })
 * ```
 */
export function designerWidgets(): readonly Type<unknown>[] {
  return [
    ModelDesignerComponent,
    FormDesignerComponent,
    DatasourceDesignerComponent,
    ProcessDesignerComponent,
    MenuEditorComponent,
    DesignerShellComponent,
    FormRefComponent,
    AdvancedFormComponent,
    ContainerComponent,
    ExportPanelComponent,
    TranslationManagerComponent,
  ];
}

export interface DesignerPagesOptions {
  /** URL prefix dla designerów. Default: '/designer'. */
  readonly basePath?: string;
  /** Angular guard (CanActivateFn lub class). Apka decyduje o dostępie. */
  readonly guard?: CanActivateFn | Type<unknown>;
  /** Angular component renderujący stronę. Wymagane — PageRouterComponent z runtime. */
  readonly component: Type<unknown>;
}

/**
 * Zwraca route'y dla stron designerów. Developer kontroluje basePath i guard.
 *
 * ```ts
 * const routes = [
 *   ...appRoutes,
 *   ...designerPages({ basePath: '/admin/tools', guard: AdminGuard, component: EchelonPageRouterComponent }),
 * ];
 * ```
 */
export function designerPages(options: DesignerPagesOptions): Routes {
  const base = (options.basePath ?? '/designer').replace(/^\//, '');
  const guard = options.guard;
  const component = options.component;

  const pages = [
    { path: base, pageId: 'pages-designer', title: 'Pages Designer' },
    { path: `${base}/models`, pageId: 'model-designer', title: 'Model Designer' },
    { path: `${base}/datasources`, pageId: 'datasources-designer', title: 'Data Sources Designer' },
    { path: `${base}/forms`, pageId: 'forms-designer', title: 'Forms Designer' },
    { path: `${base}/processes`, pageId: 'process-designer', title: 'Process Designer' },
    { path: 'menu-editor', pageId: 'menu-editor', title: 'Menu Editor' },
    { path: `${base}/translations`, pageId: 'translation-manager', title: 'Translation Manager' },
    { path: `${base}/export`, pageId: 'export-panel', title: 'Export Bundle' },
  ];

  return pages.map((p) => {
    const route: Record<string, unknown> = {
      path: p.path,
      component,
      data: { pageId: p.pageId, title: p.title },
    };
    if (guard) {
      route['canActivate'] = [guard];
    }
    return route as Routes[number];
  });
}

export interface DesignerMenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly route: string;
}

/**
 * Zwraca predefiniowane menu items dla designerów. Developer wstawia gdzie chce.
 *
 * ```ts
 * const menu = defineMenu([
 *   ...businessItems,
 *   { id: 'dev', label: 'Dev', children: designerMenuItems() },
 * ]);
 * ```
 */
export function designerMenuItems(basePath = '/designer'): readonly DesignerMenuItem[] {
  return [
    { id: 'pages-designer', label: 'Pages Designer', icon: '🎨', route: basePath },
    { id: 'model-designer', label: 'Model Designer', icon: '🧩', route: `${basePath}/models` },
    { id: 'ds-designer', label: 'Data Sources', icon: '📦', route: `${basePath}/datasources` },
    { id: 'forms-designer', label: 'Forms Designer', icon: '📋', route: `${basePath}/forms` },
    { id: 'proc-designer', label: 'Process Designer', icon: '🔄', route: `${basePath}/processes` },
    { id: 'menu-editor', label: 'Menu Editor', icon: '🧭', route: '/menu-editor' },
    { id: 'translations', label: 'Tłumaczenia', icon: '🌐', route: `${basePath}/translations` },
    { id: 'export', label: 'Export Bundle', icon: '📤', route: `${basePath}/export` },
  ];
}
