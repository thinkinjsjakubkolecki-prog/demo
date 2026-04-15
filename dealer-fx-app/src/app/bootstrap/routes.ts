/**
 * Routing apki — apka decyduje o kształcie URL-i. Każdą route mapujemy
 * na konkretny `pageId` przez `data`. EchelonPageRouterComponent najpierw
 * czyta `data.pageId`, dopiero potem fallback do `params.id`.
 *
 * Zalety: apka ma pełną kontrolę nad URL-ami (bez frameworkowego prefixu
 * `/d/...`), framework dalej rozumie `:entityId` i puszcza go do
 * `routeParams` (resolver detail).
 */
import type { Routes } from '@angular/router';
import { EchelonPageRouterComponent } from '@echelon-framework/runtime';

export const routes: Routes = [
  { path: '', redirectTo: '/clients', pathMatch: 'full' },

  { path: 'clients',
    component: EchelonPageRouterComponent,
    data: { pageId: 'clients-admin' } },

  { path: 'clients/:entityId',
    component: EchelonPageRouterComponent,
    data: { pageId: 'client-profile' } },

  { path: 'dashboard',
    component: EchelonPageRouterComponent,
    data: { pageId: 'dashboard' } },

  { path: 'positions',
    component: EchelonPageRouterComponent,
    data: { pageId: 'positions' } },

  { path: 'quote',
    component: EchelonPageRouterComponent,
    data: { pageId: 'quote' } },

  // Catch-all back-compat (`/d/:id` z legacy linków)
  { path: 'd/:id/:entityId', component: EchelonPageRouterComponent },
  { path: 'd/:id', component: EchelonPageRouterComponent },
];
