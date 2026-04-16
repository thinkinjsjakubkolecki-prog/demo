/**
 * pnlHistory — historia P&L w formacie OHLC dla chart candlestick.
 *
 * TODO po rc.16: przenieść `cache` (ttl: 60s, strategy: 'stale-while-revalidate',
 * tags: ['positions', 'pnl'], invalidateOn: ['fx.position.closed']) z
 * commenta do dekoratora — wymaga rozszerzenia `StaticDataSourceSpec` o
 * pole `cache?: CacheConfig` w `@echelon-framework/runtime`.
 *
 * Na razie cache jest wire'owany programowo przez `DefaultDataBus.cacheLookup`
 * w `framework-integrations.ts`.
 */
import { DataSource, DataSourceKind } from '@echelon-framework/runtime';

@DataSource({
  id: 'pnlHistory',
  kind: DataSourceKind.Static,
  url: '/assets/fixtures/pnl-history.json',
  description: 'Historia P&L (OHLC per interval).',
})
export class PnlHistoryDS {}
