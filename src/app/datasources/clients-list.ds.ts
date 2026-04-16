import { DataSource, DataSourceKind } from '@echelon-framework/runtime';

@DataSource({
  id: 'clientsList',
  kind: DataSourceKind.Static,
  url: '/assets/fixtures/clients.json',
  description: 'Static client master list — loaded once at app init.',
})
export class ClientsListDS {}
