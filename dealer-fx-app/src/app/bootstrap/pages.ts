/**
 * Lista stron dla `provideEchelon` — mieszanka inline `PageConfig` z
 * `@page-builders` i string ID-ów (ładowanych z `/assets/pages/<id>.jsonc`).
 */
import type { PageConfig } from '@echelon-framework/core';
import { clientsAdminPage } from '../pages/clients-admin.page';
import { clientProfilePage } from '../pages/client-profile.page';

export const pages: ReadonlyArray<string | PageConfig> = [
  clientsAdminPage,        // via defineEntityListPage
  clientProfilePage,       // via defineDetailPage
  'client-fx', 'dashboard', 'clients', 'quote', 'positions',
];
