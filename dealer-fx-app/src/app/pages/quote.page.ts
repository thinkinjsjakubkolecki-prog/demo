/** Quote (RFQ) — lewa lista klientów + środkowy formularz + prawy wynik. */
import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/quote',
  title: 'Quote',
})
export class QuotePage {
  static readonly config = PageBuilder.create('quote')
    .title('Quote')
    .ds('clientsList').ds('spotUsdPln')
    .local('selectedClient').local('quoteResult')
    .widget('title',  { x: 0, y: 0, w: 12 }, widget.any('page-title', { options: { title: 'Request For Quote', subtitle: 'Pick a client → set params → send' } }))
    .widget('list',   { x: 0, y: 1, w: 5 },  widget.any('client-list', { bind: { clients: 'clientsList' } }))
    .widget('form',   { x: 5, y: 1, w: 4 },  widget.any('dealer-quote-form', { bind: { clientCode: 'selectedClient.code', spot: 'spotUsdPln' } }))
    .widget('result', { x: 9, y: 1, w: 3 },  widget.any('stat-tile', { bind: { value: 'quoteResult' }, options: { label: 'Last quote rate', tone: 'accent' }, when: { path: 'quoteResult', exists: true } }))
    .handler('list.select', [{ setDatasource: 'selectedClient', from: '$event' } as never])
    .handler('form.submit', [
      { callComputed: 'computeDealerRate', with: ['$event.spot', '$event.side', '$event.marginPips'], into: 'quoteResult' } as never,
    ])
    .build();
}
