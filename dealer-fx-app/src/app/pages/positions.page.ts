/** Positions — live blotter z mark + close action. */
import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/positions',
  title: 'Positions',
})
export class PositionsPage {
  static readonly config = PageBuilder.create('positions')
    .title('Positions')
    .ds('positionsList').ds('spotUsdPln')
    .computed('totalPnl', 'positionsTotalPnl', ['positionsList', 'spotUsdPln'])
    .widget('title',   { x: 0, y: 0, w: 12 }, widget.any('page-title', { options: { title: 'Open Positions', subtitle: 'Live mark + close at market' } }))
    .widget('totals',  { x: 0, y: 1, w: 4 },  widget.any('stat-tile', { bind: { value: 'totalPnl' }, options: { label: 'Total P&L (live)', tone: 'profit' } }))
    .widget('blotter', { x: 0, y: 2, w: 12 }, widget.any('positions-blotter', { bind: { positions: 'positionsList', mark: 'spotUsdPln' } }))
    .handler('blotter.closeRequest', [{ emit: 'fx.position.closed', payload: '$event' } as never])
    .build();
}
