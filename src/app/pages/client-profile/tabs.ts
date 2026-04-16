/**
 * Configi tabów profilu klienta. Wszystkie taby mogą bind'ować pola z
 * resolvowanego rekordu klienta — apka udostępnia go jako globalny DS
 * `client-profile-shell__record`.
 *
 * Endpointy per sekcja są na razie placeholderami (kwestia do ustalenia
 * z backendem). Tu pokazane wzorce: Info i Użytkownicy bind'ują dane
 * z resolvera shellu, reszta to placeholdery na osobne fetch.
 */
import { PageBuilder, widget } from '@echelon-framework/page-builders';
import { clientFullViewAgg } from '../../models/client-full-view.model';

const REC = 'client-profile-shell__record';
const AGG = clientFullViewAgg;

// ─── Info — DROPPED — dane w headerze (rozwijana sekcja) ─────────────
const _tabInfoConfigDeprecated = PageBuilder.create('client-tab-info')
  .title('Info')
  .computed('infoRows',   'clientInfoRows',   [REC])
  .computed('limitsRows', 'clientLimitsRows', [REC])
  .widget('header', { x: 0, y: 0, w: 12 }, widget.any('page-title', { options: { title: 'Informacje podstawowe' } }))
  .widget('basic', { x: 0, y: 1, w: 6 }, widget.any('section-header', { options: { title: 'Identyfikacja' } }))
  .widget('basicTable', { x: 0, y: 2, w: 6 }, widget.any('data-table', {
    bind: { rows: 'infoRows' },
    options: { rowKey: 'k', columns: [
      { key: 'k', label: 'Pole',    format: 'text' },
      { key: 'v', label: 'Wartość', format: 'text' },
    ] },
  }))
  .widget('limitsHeader', { x: 6, y: 1, w: 6 }, widget.any('section-header', { options: { title: 'Limity i opiekun' } }))
  .widget('limitsTable',  { x: 6, y: 2, w: 6 }, widget.any('data-table', {
    bind: { rows: 'limitsRows' },
    options: { rowKey: 'k', columns: [
      { key: 'k', label: 'Pole',    format: 'text' },
      { key: 'v', label: 'Wartość', format: 'text' },
    ] },
  }))
  .widget('txHeader', { x: 0, y: 3, w: 12 }, widget.any('section-header', { options: { title: 'Dostępne transakcje' } }))
  .widget('txTags',   { x: 0, y: 4, w: 12 }, widget.any('entity-header', {
    bind: { tags: `${REC}.__txTags` },
    options: { name: '' },
  }))
  .widget('pairsHeader', { x: 0, y: 5, w: 12 }, widget.any('section-header', { options: { title: 'Pary walutowe' } }))
  .widget('pairsTags',   { x: 0, y: 6, w: 12 }, widget.any('entity-header', {
    bind: { tags: `${REC}.__pairsTags` },
    options: { name: '' },
  }))
  .build();
void _tabInfoConfigDeprecated;

// ─── Profil (marża + konta — aggregate z 3 endpointów) ───────────────
// Demonstracja `.aggregate()`: jednym wywołaniem rejestrujemy wszystkie
// DS-y, lifecycle.onInit i chain-trigger handlery z `clientFullViewAgg`.
const tabProfileBuilder = PageBuilder.create('client-tab-profile').title('Profil')
  .aggregate(AGG);

// Computed DS-y dla każdej sekcji read-only widoku Profil.
// Każdy używa infoRowsFromModel(ClientModel) przez pure-fn z app/functions.
const SECTIONS: ReadonlyArray<{ id: string; label: string; fn: string }> = [
  { id: 'identify',       label: 'Identyfikatory',       fn: 'clientProfile_identifyRows' },
  { id: 'basic',          label: 'Podstawowe',           fn: 'clientProfile_basicRows' },
  { id: 'classification', label: 'Klasyfikacja',         fn: 'clientProfile_classificationRows' },
  { id: 'margins',        label: 'Marże',                fn: 'clientProfile_marginsRows' },
  { id: 'managers',       label: 'Opiekunowie',          fn: 'clientProfile_managersRows' },
  { id: 'limits',         label: 'Limity i raporty',     fn: 'clientProfile_limitsRows' },
  { id: 'flags',          label: 'Dostęp i flagi',       fn: 'clientProfile_flagsRows' },
  { id: 'txAccess',       label: 'Dostępne transakcje',  fn: 'clientProfile_txAccessRows' },
];
for (const sec of SECTIONS) {
  tabProfileBuilder.computed(`${sec.id}__rows`, sec.fn, [AGG.targetDsId]);
}

// Widgety read-only sekcji — różne typy widgetów per sekcja:
//  - 'kv'    → kv-list (kompaktowy dl) — krótkie sekcje 3-4 pola
//  - 'table' → data-table k/v          — dłuższe sekcje 5+ pól
//  - 'chips' → bool-chips              — sekcje boolean (zielone/szare pigułki)
type Display = 'kv' | 'table' | 'chips';
type Layout = { id: string; label: string; fn: string; x: number; w: number; row: number; display: Display };
const LAYOUT: ReadonlyArray<Layout> = [
  { ...SECTIONS[0]!, x: 0, w: 4, row: 0, display: 'kv' },     // identify (3)
  { ...SECTIONS[1]!, x: 4, w: 4, row: 0, display: 'kv' },     // basic (3)
  { ...SECTIONS[2]!, x: 8, w: 4, row: 0, display: 'kv' },     // classification (4)
  { ...SECTIONS[3]!, x: 0, w: 4, row: 1, display: 'kv' },     // margins (5) — short enough
  { ...SECTIONS[5]!, x: 4, w: 4, row: 1, display: 'kv' },     // limits (3)
  { ...SECTIONS[4]!, x: 8, w: 4, row: 1, display: 'kv' },     // managers (6) — kv ok
  { ...SECTIONS[6]!, x: 0, w: 12, row: 2, display: 'chips' }, // flags (11) → chips full-width
  { ...SECTIONS[7]!, x: 0, w: 12, row: 3, display: 'chips' }, // txAccess (6) → chips full-width
];
function pushSectionWidgets(b: typeof tabProfileBuilder): typeof tabProfileBuilder {
  for (const s of LAYOUT) {
    const yHdr = 1 + s.row * 2;
    const yBody = yHdr + 1;
    b.widget(`${s.id}__hdr`, { x: s.x, y: yHdr, w: s.w },
      widget.any('section-header', { options: { title: s.label } }));
    if (s.display === 'chips') {
      b.widget(`${s.id}__body`, { x: s.x, y: yBody, w: s.w },
        widget.any('bool-chips', { bind: { rows: `${s.id}__rows` } }));
    } else if (s.display === 'kv') {
      b.widget(`${s.id}__body`, { x: s.x, y: yBody, w: s.w },
        widget.any('kv-list', { bind: { rows: `${s.id}__rows` } }));
    } else {
      b.widget(`${s.id}__body`, { x: s.x, y: yBody, w: s.w }, widget.any('data-table', {
        bind: { rows: `${s.id}__rows` },
        options: { rowKey: 'k', columns: [
          { key: 'k', label: 'Pole',    format: 'text' },
          { key: 'v', label: 'Wartość', format: 'text' },
        ] },
      }));
    }
  }
  return b;
}

pushSectionWidgets(tabProfileBuilder);

export const tabProfileConfig = tabProfileBuilder
  .widget('header',   { x: 0, y: 0, w: 12 }, widget.any('page-title', { options: {
    title: 'Profil klienta',
    subtitle: 'Pełny widok pól (read-only). Klik „Edytuj klienta" w headerze otwiera formularz.',
  } }))
  .widget('accountsHeader', { x: 0, y: 12, w: 12 }, widget.any('section-header', {
    options: { title: 'Rachunki klienta' },
  }))
  .widget('accounts', { x: 0, y: 13, w: 12 }, widget.any('data-table', {
    bind: { rows: `${AGG.targetDsId}.accounts` },
    options: { rowKey: 'id', columns: [
      { key: 'label',       label: 'Etykieta',   format: 'text' },
      { key: 'accountType', label: 'Typ',        format: 'mono' },
      { key: 'currency',    label: 'CCY',        format: 'mono' },
      { key: 'iban',        label: 'IBAN',       format: 'mono' },
      { key: 'balance',     label: 'Saldo',      format: 'number', align: 'right', decimals: 2 },
      { key: 'openedAt',    label: 'Otwarte',    format: 'mono' },
      { key: 'branch',      label: 'Oddział',    format: 'mono' },
      { key: 'default',     label: 'Domyślny',   format: 'badge', align: 'center', badges: { true: 'ok',   false: 'muted' } },
      { key: 'pending',     label: 'Zakładany',  format: 'badge', align: 'center', badges: { true: 'warn', false: 'muted' } },
      { key: 'closed',      label: 'Zamknięty',  format: 'badge', align: 'center', badges: { true: 'err',  false: 'muted' } },
    ] },
  }))
  // Marża DCD per waluta — edytowalna tabela: marża standardowa + DCD per waluta.
  .widget('dcdHeader', { x: 0, y: 10, w: 12 }, widget.any('section-header', {
    options: { title: 'Marże DCD per waluta (PLN/USD/EUR/CHF/GBP)' },
  }))
  .widget('dcdTable',  { x: 0, y: 11, w: 12 }, widget.any('editable-table', {
    bind: { rows: `${REC}.dcdMargins` },
    options: { rowKey: 'currency', allowAdd: false, allowDelete: false, columns: [
      { key: 'currency',    label: 'Waluta',                  format: 'mono' },
      { key: 'bpsStandard', label: 'Marża standardowa (bps)', format: 'number', align: 'right',
        editable: true, inputType: 'number', decimals: 0 },
      { key: 'bps',         label: 'Marża DCD (bps)',         format: 'number', align: 'right',
        editable: true, inputType: 'number', decimals: 0 },
    ] },
  }))
  // Limity przewalutowań — per-para
  .widget('ccyHeader', { x: 0, y: 14, w: 12 }, widget.any('section-header', {
    options: { title: 'Limity przewalutowań' },
  }))
  .widget('ccyTable',  { x: 0, y: 15, w: 12 }, widget.any('editable-table', {
    bind: { rows: `${REC}.currencyConversionLimits` },
    options: { rowKey: 'pair', allowAdd: true, allowDelete: true, addLabel: 'Dodaj parę', columns: [
      { key: 'pair',         label: 'Para walutowa',  format: 'mono',
        editable: true, inputType: 'text' },
      { key: 'limitType',    label: 'Rodzaj limitu',  format: 'badge',
        badges: { INDIVIDUAL: 'info', GLOBAL: 'muted' },
        editable: true, inputType: 'select', options: [
          { value: 'INDIVIDUAL', label: 'Indywidualny' },
          { value: 'GLOBAL',     label: 'Globalny' },
        ] },
      { key: 'minAmount',    label: 'Min kwota',      format: 'number', align: 'right', decimals: 0,
        editable: true, inputType: 'number' },
      { key: 'maxAmount',    label: 'Max kwota',      format: 'number', align: 'right', decimals: 0,
        editable: true, inputType: 'number' },
      { key: 'dailyLimit',   label: 'Limit dzienny',  format: 'number', align: 'right', decimals: 0,
        editable: true, inputType: 'number' },
      { key: 'monthlyLimit', label: 'Limit miesięczny', format: 'number', align: 'right', decimals: 0,
        editable: true, inputType: 'number' },
    ] },
  }))
  .build();

// ─── Użytkownicy (uscrs) ──────────────────────────────────────────────
// Tabela + right-side panel: inline edit pól tekstowych w tabeli, klik wiersza
// otwiera pełny formularz w sidebarze (włącznie z boolean checkboxami).
const USER_EDIT_FIELDS = [
  { key: 'id2Key',          label: 'ID (i2key)',     format: 'mono' as const },
  { key: 'pesel',           label: 'PESEL',          format: 'mono' as const },
  { key: 'nameAndSurname',  label: 'Imię i nazwisko', editable: true, editType: 'text' as const, group: 'Identyfikacja' },
  { key: 'dataUrodzenia',   label: 'Data urodzenia',  editable: true, editType: 'date' as const, group: 'Identyfikacja' },
  { key: 'pelnomocnik',     label: 'Pełnomocnik',     editable: true, editType: 'checkbox' as const, group: 'Uprawnienia' },
  { key: 'dostep',          label: 'Dostęp do systemu', editable: true, editType: 'checkbox' as const, group: 'Uprawnienia' },
  { key: 'blokada',         label: 'Blokada (info)',  editable: true, editType: 'text' as const, group: 'Uprawnienia' },
  { key: 'fxPlanetVersion', label: 'Wersja FX Planet', editable: true, editType: 'select' as const, group: 'Konfiguracja',
    editOptions: [{ value: 'NEW', label: 'NEW' }, { value: 'OLD', label: 'OLD' }] },
  { key: 'notifTxExpiry',   label: 'Powiadom. końca tx', editable: true, editType: 'checkbox' as const, group: 'Powiadomienia' },
  { key: 'notifDcd',        label: 'Powiadom. DCD',   editable: true, editType: 'checkbox' as const, group: 'Powiadomienia' },
];

export const tabUsersConfig = PageBuilder.create('client-tab-users')
  .title('Użytkownicy')
  .widget('header', { x: 0, y: 0, w: 12 }, widget.any('page-toolbar', {
    options: { title: 'Użytkownicy klienta', addLabel: 'Dodaj użytkownika' },
  }))
  .widget('table',  { x: 0, y: 1, w: 12 }, widget.any('editable-table', {
    bind: { rows: `${REC}.uscrs` },
    options: {
      rowKey: 'id2Key',
      // Edycja tylko przez right-side panel (klik wiersza). Inline edit zablokowany.
      inlineEdit: false,
      allowAdd: true, allowDelete: false, addLabel: 'Dodaj użytkownika',
      columns: [
        { key: 'id2Key',          label: 'ID (i2key)',       format: 'mono' },
        { key: 'pesel',           label: 'PESEL',            format: 'mono' },
        { key: 'nameAndSurname',  label: 'Imię i nazwisko',  format: 'text' },
        { key: 'dataUrodzenia',   label: 'Data urodzenia',   format: 'mono' },
        { key: 'pelnomocnik',     label: 'Pełnomocnik',      format: 'badge', align: 'center', badges: { true: 'ok', false: 'muted' } },
        { key: 'dostep',          label: 'Dostęp',           format: 'badge', align: 'center', badges: { true: 'ok', false: 'err' } },
        { key: 'blokada',         label: 'Blokada',          format: 'text' },
        { key: 'fxPlanetVersion', label: 'FX Planet',        format: 'tag', tagColors: { NEW: '#3fb950', OLD: '#8b949e' } },
        { key: 'notifTxExpiry',   label: 'Powiadom. tx',     format: 'badge', align: 'center', badges: { true: 'ok', false: 'muted' } },
        { key: 'notifDcd',        label: 'Powiadom. DCD',    format: 'badge', align: 'center', badges: { true: 'ok', false: 'muted' } },
      ],
    },
  }))
  // Right-side panel: edycja całego usera w sidebarze (włącznie z checkboxami).
  .widget('userSidebar', { x: 0, y: 2, w: 12 }, widget.any('context-sidebar', {
    bind: { record: '__selected_user' },
    options: {
      titleField: 'nameAndSurname',
      subtitleField: 'pesel',
      width: 480,
      layout: 'edit-form',
      accordion: true,
      fields: USER_EDIT_FIELDS,
      actions: [
        { id: 'save',   label: 'Zapisz',  kind: 'primary', inLayout: ['edit-form'],
          success: { message: 'Zapisano użytkownika', duration: 1500, returnTo: 'edit-form' } },
        { id: 'delete', label: 'Usuń użytkownika', kind: 'danger', inLayout: ['edit-form'],
          confirm: {
            title: 'Usunięcie użytkownika',
            message: 'Ta akcja jest nieodwracalna. Czy na pewno chcesz usunąć tego użytkownika?',
            confirmLabel: 'Tak, usuń',
            cancelLabel: 'Anuluj',
          },
          success: { message: 'Użytkownik usunięty', duration: 1500, closeAfter: true } },
        { id: 'cancel', label: 'Anuluj',  kind: 'ghost',   inLayout: ['edit-form'] },
      ],
    },
  }))
  .ds('__selected_user', { kind: 'local', initial: null })
  .handler('header.add', [{ emit: 'user.create.requested' } as never])
  .handler('table.rowClick', [
    { setDatasource: '__selected_user', from: '$event' } as never,
  ])
  .handler('table.rowAdd', [{ emit: 'user.create.requested' } as never])
  .handler('table.rowDelete', [
    { fetch: 'user-delete', into: '__user_delete_resp', with: { id2Key: '$event.id2Key' } } as never,
  ])
  .handler('table.rowUpdate', [
    { fetch: 'user-update', into: '__user_update_resp', with: '$event' } as never,
  ])
  .handler('userSidebar.close', [{ clearDatasource: '__selected_user' } as never])
  .handler('userSidebar.action', [
    { fetch: 'user-update', into: '__user_update_resp', with: '$event.record' } as never,
  ])
  .handler('userSidebar.action', [
    { fetch: 'user-delete', into: '__user_delete_resp', with: { id2Key: '$event.record.id2Key' } } as never,
    { clearDatasource: '__selected_user' } as never,
  ], { path: 'id', eq: 'delete' })
  .ds('__user_delete_resp', { kind: 'local', initial: null })
  .ds('__user_update_resp', { kind: 'local', initial: null })
  .build();

// ─── Transakcje FX ────────────────────────────────────────────────────
// 5 typów = 5 dedykowanych stron formularzy pod `/new-transaction/:clientId/:txType`.
// Action-bar tu nawiguje; sama strona formularza w `new-transaction.page.ts`.

// Field defs przeniesione do `tx-types.ts` — używane przez `new-transaction.page.ts`.

export const tabTransactionsFxConfig = PageBuilder.create('client-tab-transactions-fx')
  .title('Transakcje FX')
  .ds('fxTransactions')
  .local('filtersState', null).local('page', 1).local('pageSize', 10)
  .computed('filteredAll',  'searchRows', ['fxTransactions', 'filtersState'])
  .computed('filteredPage', 'paginate',   ['filteredAll', 'page', 'pageSize'])
  .computed('totalPages',   'totalPages', ['filteredAll', 'pageSize'])
  .widget('actionsBar', widget.any('actions-bar', {
    options: { actions: [
      { id: 'fx',        label: 'TRANSAKCJA FX',    icon: '💱', variant: 'primary' },
      { id: 'swap',      label: 'SWAP',             icon: '⇄',  variant: 'primary' },
      { id: 'spot-pay',  label: 'SPOT FOR PAYMENT', icon: '₴',  variant: 'primary' },
      { id: 'multi-fwd', label: 'MULTIFORWARD',     icon: '⇉',  variant: 'primary' },
      { id: 'par-fwd',   label: 'PARFORWARD',       icon: '≡',  variant: 'primary' },
    ] },
  }))
  .widget('header', widget.any('section-header', { options: { title: 'Historia transakcji' } }))
  .widget('table', widget.any('data-table', {
    bind: { rows: 'filteredPage' },
    options: { rowKey: 'nrFx', columns: [
      { key: 'nrFx',       label: 'Nr FX',         format: 'mono' },
      { key: 'dateTraded', label: 'Data zawarcia', format: 'mono' },
      { key: 'type',       label: 'Typ',           format: 'text' },
      { key: 'amount',     label: 'Kwota',         format: 'number', align: 'right', decimals: 2 },
      { key: 'currency',   label: 'Waluta',        format: 'mono' },
      { key: 'rate',       label: 'Kurs',          format: 'number', align: 'right', decimals: 4 },
      { key: 'status',     label: 'Status',        format: 'badge', badges: { Wykonana: 'ok', Rozliczona: 'info' } },
    ] },
  }))
  .widget('pagination', widget.any('pagination', {
    bind: { page: 'page', totalPages: 'totalPages', pageSize: 'pageSize' },
  }))
  // Klik przycisku typu → nawigacja na dedykowaną stronę formularza.
  .handler('actionsBar.actionClick', [
    { navigate: ['/new-transaction', '$ds.routeParams.entityId', '$event'] } as never,
  ])
  .handler('pagination.pageChange',     [{ setDatasource: 'page', from: '$event' } as never])
  .handler('pagination.pageSizeChange', [
    { setDatasource: 'pageSize', from: '$event' } as never,
    { setDatasource: 'page',     from: 'static:1' } as never,
  ])
  .build();

// ─── Reszta — placeholdery (do podpięcia z backendem) ────────────────
function placeholder(id: string, title: string, subtitle: string) {
  return PageBuilder.create(id)
    .title(title)
    .widget('placeholder', widget.any('page-title', { options: { title, subtitle } }))
    .build();
}

export const tabOffersFxConfig     = placeholder('client-tab-offers-fx',    'Oferty FX',     'TODO: endpoint client-offers');
export const tabAlertsConfig       = placeholder('client-tab-alerts',        'Alerty kursowe','TODO: endpoint client-alerts');
export const tabDcdConfig          = placeholder('client-tab-dcd',           'DCD',           'TODO: endpoint client-dcd');
export const tabMarginExanteConfig = placeholder('client-tab-margin-exante', 'Marża EX-ANTE', 'TODO: endpoint margin-matrix');
