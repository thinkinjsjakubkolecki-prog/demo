import { DataSource, DataSourceKind } from '@echelon-framework/runtime';

@DataSource({
  id: 'fxTransactions',
  kind: DataSourceKind.Static,
  url: '/assets/fixtures/fx-transactions.json',
  description: 'Historia transakcji FX dla aktywnego klienta.',
})
export class FxTransactionsDS {}
