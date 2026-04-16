/** Dashboard — KPIs + live spot. */
import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/dashboard',
  title: 'Dealer Overview',
})
export class DashboardPage {
  static readonly config = PageBuilder.create('dashboard')
    .title('Dealer Overview')
    .ds('spotUsdPln').ds('positionsList')
    .computed('spotMidVal', 'computeDealerRate', ['spotUsdPln'])
    .computed('totalPnl',   'positionsTotalPnl', ['positionsList', 'spotUsdPln'])
    .widget('title',   { x: 0, y: 0, w: 12 }, widget.any('page-title', { options: { title: 'Dealer Overview', subtitle: 'Live FX desk monitor' } }))
    .widget('spotMid', { x: 0, y: 1, w: 3 },  widget.any('stat-tile', { bind: { value: 'spotUsdPln.bid' }, options: { label: 'USD/PLN bid', tone: 'accent' } }))
    .widget('spread',  { x: 3, y: 1, w: 3 },  widget.any('stat-tile', { bind: { value: 'spotUsdPln.ask' }, options: { label: 'USD/PLN ask', tone: 'accent' } }))
    .widget('openPos', { x: 6, y: 1, w: 3 },  widget.any('stat-tile', { bind: { value: 'positionsList.length' }, options: { label: 'Open positions' } }))
    .widget('totPnl',  { x: 9, y: 1, w: 3 },  widget.any('stat-tile', { bind: { value: 'totalPnl' }, options: { label: 'Live P&L', tone: 'profit' } }))
    .build();
}
