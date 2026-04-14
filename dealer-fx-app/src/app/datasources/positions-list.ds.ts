import { DataSource, DataSourceKind } from '@echelon-framework/runtime';

@DataSource({
  id: 'positionsList',
  kind: DataSourceKind.Static,
  url: '/assets/fixtures/positions.json',
  description: 'Open FX positions snapshot — loaded once at app init.',
})
export class PositionsListDS {}
