/**
 * `client-profile` — strona profilu klienta zbudowana przez `defineDetailPage`.
 *
 * Resolver po `routeParams.entityId` woła endpoint `client-by-id` (registered
 * w app.config) — apka nie pisze datasource'ów ani lifecycle ręcznie.
 */
import { defineDetailPage } from '@echelon-framework/page-builders';

interface Client {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: string;
  readonly marginGroup: string;
}

export const clientProfilePage = defineDetailPage<Client>({
  id: 'client-profile',
  title: 'Klient — Profil',
  resolver: { endpoint: 'client-by-id', paramKey: 'id' },
  routeParamKey: 'entityId',
  header: { nameField: 'name', subtitleField: 'code' },
});
