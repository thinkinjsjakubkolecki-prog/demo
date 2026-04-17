/// <reference types="vite/client" />
/**
 * Discovery stron — tylko designery z frameworka.
 * Biznesowe strony dodajesz tutaj po eksporcie z designera.
 */
import { collectRegisteredPages } from '@echelon-framework/page-builders';
import { EchelonPageRouterComponent } from '@echelon-framework/runtime';
import { EchelonDetailShellComponent } from '@echelon-framework/widgets-core';

// Strony designerów z frameworka
import '../framework/designer.page';
import '../framework/menu-editor.page';
import '../framework/datasources-designer.page';
import '../framework/forms-designer.page';
import '../framework/process-designer.page';
import '../framework/model-designer.page';
import '../framework/translation-manager.page';
import '../framework/theme-manager.page';
import '../framework/export.page';

export const { pages, routes, declarations } = collectRegisteredPages({
  component: EchelonPageRouterComponent,
  tabbedShell: EchelonDetailShellComponent,
});
