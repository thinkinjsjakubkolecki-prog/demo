import { DataSource, DataSourceKind } from '@echelon-framework/runtime';

@DataSource({
  id: 'clientProfile',
  kind: DataSourceKind.Static,
  url: '/assets/fixtures/client-profile.json',
  description: 'Profil klienta (nazwa, lokalizacja, opiekunowie jako tagi).',
})
export class ClientProfileDS {}

@DataSource({
  id: 'clientMargins',
  kind: DataSourceKind.Static,
  url: '/assets/fixtures/client-margins.json',
  description: 'Marże walutowe (bps) przypisane do klienta.',
})
export class ClientMarginsDS {}

@DataSource({
  id: 'clientAccounts',
  kind: DataSourceKind.Static,
  url: '/assets/fixtures/client-accounts.json',
  description: 'Lista rachunków klienta w różnych walutach.',
})
export class ClientAccountsDS {}
