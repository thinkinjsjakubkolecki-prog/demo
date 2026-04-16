/**
 * Routes — wygenerowane z `@definePage(...)` w plikach `pages/*.page.ts`.
 * Apka dodaje tylko redirect z `''` na domyślną stronę.
 */
import type { Routes } from '@angular/router';
import { routes as autoRoutes } from './pages';

export const routes: Routes = [
  { path: '', redirectTo: '/clients', pathMatch: 'full' },
  ...autoRoutes,
];
