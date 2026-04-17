/**
 * FX Spot Deal — strona z live pricing stream + tryb RFQ.
 *
 * Lista klientów po lewej, formularz deal-owy po środku (live bid/ask),
 * wynik/historia po prawej.
 */
import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/fx-spot',
  title: 'FX Spot Deal',
})
export class FxSpotPage {
  static readonly config = PageBuilder.create('fx-spot')
    .title('FX Spot Deal')
    .ds('clientsList')
    .ds('spotUsdPln')
    .local('selectedClient')
    .local('dealResult')
    .widget('title', { x: 0, y: 0, w: 12 }, widget.any('page-title', {
      options: { title: 'FX Spot — Transakcja', subtitle: 'Live pricing + RFQ flow' },
    }))
    .widget('clients', { x: 0, y: 1, w: 3, h: 10 }, widget.any('client-list', {
      bind: { clients: 'clientsList' },
    }))
    .widget('deal', { x: 3, y: 1, w: 9, h: 10 }, widget.any('fx-spot-deal', {
      bind: {
        clientCode: 'selectedClient.code',
        clientName: 'selectedClient.name',
        spot: 'spotUsdPln',
      },
    }))
    .handler('clients.select', [
      { setDatasource: 'selectedClient', from: '$event' } as never,
    ])
    .handler('deal.submit', [
      { setDatasource: 'dealResult', from: '$event' } as never,
      { emit: 'fx.spot.deal.completed', payload: '$event' } as never,
    ])
    .handler('deal.rfqAccept', [
      { setDatasource: 'dealResult', from: '$event' } as never,
      { emit: 'fx.spot.rfq.accepted', payload: '$event' } as never,
    ])
    .build();
}
