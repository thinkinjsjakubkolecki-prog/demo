/**
 * Nowa transakcja — jedna strona dla wszystkich 5 typów.
 * Route: /new-transaction/:entityId/:txType
 *
 * `txType` (np. 'fx', 'swap') pochodzi z routeParams — computed DS
 * `txFields` / `txSections` / `txLabel` wylicza je przez pure-functions.
 * Widget `validated-form` binduje pola z DS zamiast opcji statycznych.
 */
import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({ route: '/new-transaction/:entityId/:txType', title: 'Nowa transakcja' })
export class NewTransactionPage {
  static readonly config = PageBuilder.create('new-transaction')
    .title('Nowa transakcja')
    .local('formValue', {})
    .local('txResp', null)
    .computed('txFields',   'txFieldsForType',   ['routeParams'])
    .computed('txSections', 'txSectionsForType', ['routeParams'])
    .computed('txLabel',    'txLabelForType',    ['routeParams'])
    .widget('title', widget.any('page-title', {
      bind:    { title: 'txLabel' },
      options: { subtitle: 'Nowa transakcja' },
    }))
    .widget('form', widget.any('validated-form', {
      bind:    { fields: 'txFields', sections: 'txSections', initial: 'formValue' },
      options: { submitLabel: 'Wyślij' },
    }))
    .handler('form.submit', [
      { fetch: 'tx-create', into: 'txResp', with: '$event' } as never,
      { navigate: ['/clients', '$ds.routeParams.entityId', 'transactions-fx'] } as never,
    ])
    .handler('form.cancel', [
      { navigate: ['/clients', '$ds.routeParams.entityId', 'transactions-fx'] } as never,
    ])
    .build();
}
