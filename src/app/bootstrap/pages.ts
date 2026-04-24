/// <reference types="vite/client" />
/**
 * Discovery stron — designery z @echelon-framework/designer-widgets.
 * Biznesowe strony dodajesz tutaj po eksporcie z designera.
 */
import { collectRegisteredPages } from '@echelon-framework/page-builders';
import { EchelonPageRouterComponent } from '@echelon-framework/runtime';
import { EchelonDetailShellComponent } from '@echelon-framework/widgets-core';

// Side-effect imports — rejestracja page klas z frameworka
import '@echelon-framework/designer-widgets/designer.page';
import '@echelon-framework/designer-widgets/menu-editor.page';
import '@echelon-framework/designer-widgets/datasources-designer.page';
import '@echelon-framework/designer-widgets/forms-designer.page';
import '@echelon-framework/designer-widgets/process-designer.page';
import '@echelon-framework/designer-widgets/model-designer.page';
import '@echelon-framework/designer-widgets/translation-manager.page';
import '@echelon-framework/designer-widgets/theme-manager.page';

export const { pages, routes, declarations } = collectRegisteredPages({
  component: EchelonPageRouterComponent,
  tabbedShell: EchelonDetailShellComponent,
});
