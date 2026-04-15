/// <reference types="vite/client" />
/**
 * Discovery stron — ładujemy wszystkie pliki `pages/*.page.ts` żeby
 * `@Page(...)` zdążyło się wykonać i zarejestrować strony przed
 * `collectRegisteredPages()`.
 *
 * Próbujemy najpierw `import.meta.glob` (Vite). Jeśli build nie obsługuje
 * (różne wersje @angular/build), fallback to explicit imports niżej —
 * apka i tak musi je dodać raz, ale auto-rejestracja działa.
 */
import { collectRegisteredPages } from '@echelon-framework/page-builders';
import { EchelonPageRouterComponent } from '@echelon-framework/runtime';
import { EchelonDetailShellComponent } from '@echelon-framework/widgets-core';

// Explicit side-effect imports (fallback). Każdy import → @Page() runs → REGISTRY filled.
import '../pages/clients-admin.page';
import '../pages/client-profile.page';
import '../pages/dashboard.page';
import '../pages/positions.page';
import '../pages/quote.page';
import '../pages/clients.page';
import '../pages/client-fx.page';
import '../pages/new-transaction.page';

export const { pages, routes, declarations } = collectRegisteredPages({
  component: EchelonPageRouterComponent,
  tabbedShell: EchelonDetailShellComponent,
});

// eslint-disable-next-line no-console
console.log('[bootstrap/pages] discovered:', { count: pages.length, routes: routes.map((r) => (r as { path: string }).path) });
