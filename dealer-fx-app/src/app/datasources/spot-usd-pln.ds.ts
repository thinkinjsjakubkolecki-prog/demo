import { DataSource, DataSourceKind } from '@echelon-framework/runtime';

@DataSource({
  id: 'spotUsdPln',
  kind: DataSourceKind.Stream,
  description: 'Live USD/PLN spot — random-walk simulator (replace with WS in prod).',
  simulator: {
    kind: 'fx-random-walk',
    mid: 4.05,
    vol: 0.0003,
    bounds: [3.9, 4.2],
    precision: 5,
    intervalMs: 600,
  },
})
export class SpotUsdPlnDS {}
