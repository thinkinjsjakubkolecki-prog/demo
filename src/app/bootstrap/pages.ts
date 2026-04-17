/// <reference types="vite/client" />
/**
 * Discovery stron — biznesowe z apki + designery z frameworka.
 */
import { collectRegisteredPages } from '@echelon-framework/page-builders';
import { EchelonPageRouterComponent } from '@echelon-framework/runtime';
import { EchelonDetailShellComponent } from '@echelon-framework/widgets-core';

// Biznesowe strony apki
import '../pages/clients-admin.page';
import '../pages/client-profile.page';
import '../pages/dashboard.page';
import '../pages/positions.page';
import '../pages/quote.page';
import '../pages/clients.page';
import '../pages/client-fx.page';
import '../pages/new-transaction.page';
import '../pages/process-flow.page';
import '../pages/business-flow.page';

// Strony designerów — z frameworka (side-effect import rejestruje @Page)
import '../framework/designer.page';
import '../framework/menu-editor.page';
import '../framework/datasources-designer.page';
import '../framework/forms-designer.page';
import '../framework/process-designer.page';
import '../framework/model-designer.page';
import '../framework/export.page';

export const { pages, routes, declarations } = collectRegisteredPages({
  component: EchelonPageRouterComponent,
  tabbedShell: EchelonDetailShellComponent,
});

// eslint-disable-next-line no-console
console.log('[bootstrap/pages] discovered:', { count: pages.length, routes: routes.map((r) => (r as { path: string }).path) });
