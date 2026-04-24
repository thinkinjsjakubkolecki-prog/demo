/**
 * Routes — z frameworka. Zero custom komponentów.
 */
import type { Routes } from '@angular/router';
import { routes as autoRoutes } from './pages';
import { designerDraftRoutes } from '@echelon-framework/designer-widgets';

export const routes: Routes = [
  { path: '', redirectTo: '/designer', pathMatch: 'full' },
  ...designerDraftRoutes(),
  ...autoRoutes,
];
