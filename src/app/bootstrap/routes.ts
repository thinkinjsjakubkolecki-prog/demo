/**
 * Routes — wygenerowane z `@definePage(...)` w plikach `pages/*.page.ts`.
 * Apka dodaje redirect z `''` na domyślną stronę + dynamiczny route
 * dla draftów designera (persisted w localStorage).
 */
import type { Routes } from '@angular/router';
import { routes as autoRoutes } from './pages';
import { DraftPageRendererComponent } from '../pages/draft-page-renderer.component';

export const routes: Routes = [
  { path: '', redirectTo: '/designer', pathMatch: 'full' },
  // Dynamic route dla draftów designera — czyta ID z URL, resolve przez
  // DraftPageStoreService (localStorage). Nie wymaga rebuildu appki.
  { path: 'draft/:id', component: DraftPageRendererComponent },
  ...autoRoutes,
];
