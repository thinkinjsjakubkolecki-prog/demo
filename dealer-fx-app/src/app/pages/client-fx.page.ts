/** FX klienta — tabs, header, actions, search + paginated table transakcji. */
import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/d/client-fx',
  title: 'Klient — FX',
})
export class ClientFxPage {
  static readonly config = PageBuilder.create('client-fx')
    .title('Klient — FX')
    .ds('fxTransactions')
    .local('activeTab', 'transakcje-fx').local('filtersState', null)
    .local('page', 1).local('pageSize', 10)
    .computed('filteredAll',  'searchRows', ['fxTransactions', 'filtersState'])
    .computed('filteredPage', 'paginate',   ['filteredAll', 'page', 'pageSize'])
    .computed('totalPages',   'totalPages', ['filteredAll', 'pageSize'])
    .widget('tabs',    { x: 0, y: 0, w: 12 }, widget.any('tab-strip', {
      bind: { activeId: 'activeTab' },
      options: { tabs: [
        { id: 'klienci',       label: 'Klienci' },
        { id: 'profil',        label: 'Profil' },
        { id: 'uzytkownicy',   label: 'Użytkownicy' },
        { id: 'transakcje-fx', label: 'Transakcje FX' },
        { id: 'oferty-fx',     label: 'Oferty FX' },
        { id: 'alerty',        label: 'Alerty Kursowe' },
        { id: 'ex-ante',       label: 'Matryca EX-ANTE' },
      ] },
    }))
    .widget('header',  { x: 0, y: 1, w: 12 }, widget.any('entity-header', {
      options: {
        name: 'Velo Sp. z o.o.',
        tags: [
          { label: 'TODAY', variant: 'enabled' }, { label: 'SPOT', variant: 'enabled' },
          { label: 'FORWARD', variant: 'enabled' }, { label: 'SWAP', variant: 'enabled' },
          { label: '+ SFP', variant: 'extended' }, { label: '+ DCD', variant: 'extended' },
        ],
      },
    }))
    .widget('actions', { x: 0, y: 2, w: 12 }, widget.any('actions-bar', {
      options: { actions: [
        { id: 'fx',        label: 'TRANSAKCJA FX',    icon: '💱', variant: 'primary' },
        { id: 'swap',      label: 'SWAP',             icon: '⇄',  variant: 'primary' },
        { id: 'spot-pay',  label: 'SPOT FOR PAYMENT', icon: '₴',  variant: 'primary' },
        { id: 'multi-fwd', label: 'MULTIFORWARD',     icon: '⇉',  variant: 'primary' },
        { id: 'par-fwd',   label: 'PARFORWARD',       icon: '≡',  variant: 'primary' },
      ] },
    }))
    .widget('search',  { x: 0, y: 3, w: 12 }, widget.any('filter-form', {
      options: { cols: 6, fields: [
        { id: 'nrFx',   label: 'Nr FX',    type: 'text', placeholder: 'np. FX-00123' },
        { id: 'client', label: 'Klient',   type: 'text', placeholder: 'np. Velo' },
        { id: 'type',   label: 'Typ',      type: 'select', options: [
          { value: 'SPOT', label: 'SPOT' }, { value: 'FX FORWARD', label: 'FX FORWARD' }, { value: 'SWAP', label: 'SWAP' },
        ] },
        { id: 'status', label: 'Status',   type: 'select', options: [
          { value: 'Wykonana', label: 'Wykonana' }, { value: 'Rozliczona', label: 'Rozliczona' },
        ] },
        { id: 'direction', label: 'Kierunek', type: 'select', options: [
          { value: 'INTERNET', label: 'INTERNET' }, { value: 'DEALER', label: 'DEALER' },
        ] },
        { id: 'q', label: 'Szukaj (wszędzie)', type: 'text', placeholder: 'dowolny tekst' },
      ] },
    }))
    .widget('table',   { x: 0, y: 4, w: 12 }, widget.any('data-table', {
      bind: { rows: 'filteredPage' },
      options: { rowKey: 'nrFx', columns: [
        { key: 'nrFx',       label: 'Nr FX',         format: 'mono' },
        { key: 'client',     label: 'Klient',        format: 'text' },
        { key: 'dateTraded', label: 'Data zawarcia', format: 'mono' },
        { key: 'type',       label: 'Typ',           format: 'text' },
        { key: 'amount',     label: 'Kwota',         format: 'number', align: 'right', decimals: 2 },
        { key: 'currency',   label: 'Waluta',        format: 'mono' },
        { key: 'rate',       label: 'Kurs',          format: 'number', align: 'right', decimals: 4 },
        { key: 'status',     label: 'Status',        format: 'badge', badges: { Wykonana: 'ok', Rozliczona: 'info' } },
        { key: 'direction',  label: 'Kierunek',      format: 'tag',   tagColors: { INTERNET: '#58a6ff', DEALER: '#d29922' } },
      ] },
    }))
    .widget('pagination', { x: 0, y: 5, w: 12 }, widget.any('pagination', {
      bind: { page: 'page', totalPages: 'totalPages', pageSize: 'pageSize' },
    }))
    .handler('search.search', [
      { setDatasource: 'filtersState', from: '$event' } as never,
      { setDatasource: 'page', from: 'static:1' } as never,
    ])
    .handler('search.clear', [
      { clearDatasource: 'filtersState' } as never,
      { setDatasource: 'page', from: 'static:1' } as never,
    ])
    .handler('pagination.pageChange',     [{ setDatasource: 'page', from: '$event' } as never])
    .handler('pagination.pageSizeChange', [
      { setDatasource: 'pageSize', from: '$event' } as never,
      { setDatasource: 'page',     from: 'static:1' } as never,
    ])
    .handler('tabs.change', [{ setDatasource: 'activeTab', from: '$event' } as never])
    .build();
}
