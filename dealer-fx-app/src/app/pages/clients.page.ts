/** Clients — search-filterable list (legacy demo). */
import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/clients-legacy',
  title: 'Clients (legacy)',
})
export class ClientsLegacyPage {
  static readonly config = PageBuilder.create('clients')
    .title('Clients')
    .ds('clientsList')
    .local('searchQuery', '')
    .computed('filteredClients', 'filterClients', ['clientsList', 'searchQuery'])
    .local('selectedClient')
    .widget('title', { x: 0, y: 0, w: 12 }, widget.any('page-title', { options: { title: 'Clients', subtitle: 'Search & select to start a quote' } }))
    .widget('list',  { x: 0, y: 1, w: 8 },  widget.any('client-list', { bind: { clients: 'filteredClients', query: 'searchQuery' } }))
    .handler('list.queryChange', [{ setDatasource: 'searchQuery', from: '$event' } as never])
    .handler('list.select', [
      { setDatasource: 'selectedClient', from: '$event' } as never,
      { emit: 'client.selected', payload: '$event' } as never,
    ])
    .build();
}
