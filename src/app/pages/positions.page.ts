/** Positions — live blotter z mark + close action + wykres + CSV export.
 *
 * Integracje v0.2 rc.15:
 *   - i18n keys dla labeli (`i18n:positions.*`) — resolved przez
 *     JsonDictionaryI18nService z framework-integrations.ts,
 *   - candlestick-chart widget — zarejestrowany w widgets.ts, pod spodem
 *     korzysta z ECharts adaptera (charts-echarts),
 *   - CSV export — trigger przez handler 'positions.exportCsv' →
 *     EventBus → app.component.ts subscription → exportPositionsToCsv(),
 *   - feature-flag gate (candlestick-chart, quote-form-v2) — obecnie
 *     wire'owany programowo przez isFeatureFlagAllowed() w
 *     framework-integrations.ts; TODO rc.16: dodać `featureFlag` pole
 *     do widget.any() w page-builders.
 */
import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/positions',
  title: 'Positions',
})
export class PositionsPage {
  static readonly config = PageBuilder.create('positions')
    .title('Positions')
    .ds('positionsList').ds('spotUsdPln').ds('pnlHistory')
    .computed('totalPnl', 'positionsTotalPnl', ['positionsList', 'spotUsdPln'])
    .widget('title',   { x: 0, y: 0, w: 12 }, widget.any('page-title', {
      options: { title: 'i18n:positions.total', subtitle: 'Live mark + close at market' },
    }))
    .widget('totals',  { x: 0, y: 1, w: 4 },  widget.any('stat-tile', {
      bind: { value: 'totalPnl' },
      options: { label: 'i18n:positions.total', tone: 'profit' },
    }))
    .widget('chart',   { x: 4, y: 1, w: 8, h: 3 }, widget.any('candlestick-chart', {
      bind: { data: 'pnlHistory' },
      options: { kind: 'candlestick', xField: 'timestamp', theme: 'dark', requiresFlag: 'candlestick-chart' },
    }))
    .widget('blotter', { x: 0, y: 4, w: 12, h: 4 }, widget.any('positions-blotter', {
      bind: { positions: 'positionsList', mark: 'spotUsdPln' },
      options: { exportEvent: 'positions.exportCsv' },
    }))
    .handler('blotter.closeRequest', [{ emit: 'fx.position.closed', payload: '$event' } as never])
    .handler('positions.exportCsv', [
      { emit: 'fx.positions.csv.download-requested', payload: '$event' } as never,
    ])
    .build();
}
