/**
 * Seed designerów — wstrzykuje realne artefakty (strona FX Spot, formularz)
 * jako drafty żeby były widoczne i edytowalne w Pages/Forms/Process Designerze.
 *
 * Idempotentny — nie nadpisuje jeśli draft już istnieje.
 */
import { DraftPageStoreService } from '../services/draft-page-store.service';
import { DraftFormStoreService } from '../services/draft-form-store.service';
import type { PageConfig } from '@echelon-framework/core';

export function seedDesigners(
  pageStore: DraftPageStoreService,
  formStore: DraftFormStoreService,
): void {
  seedFxSpotPage(pageStore);
  seedFxSpotForm(formStore);
  seedFxSpotDealForm(formStore);
  seedFxSpotFormPage(pageStore);
}

function seedFxSpotPage(store: DraftPageStoreService): void {
  if (store.get('fx-spot')) return;

  const config: PageConfig = {
    $schemaVersion: '2026.04-alpha' as PageConfig['$schemaVersion'],
    page: {
      id: 'fx-spot',
      title: 'FX Spot Deal',
      datasources: {
        clientsList: {},
        spotUsdPln: {},
        selectedClient: { kind: 'local', initial: null },
        dealResult: { kind: 'local', initial: null },
      },
      layout: {
        type: 'grid',
        cols: 12,
        items: [
          { widget: 'title', x: 0, y: 0, w: 12 },
          { widget: 'clients', x: 0, y: 1, w: 3, h: 10 },
          { widget: 'deal', x: 3, y: 1, w: 9, h: 10 },
        ],
      },
      widgets: {
        title: {
          type: 'page-title',
          options: { title: 'FX Spot — Transakcja', subtitle: 'Live pricing + RFQ flow' },
        },
        clients: {
          type: 'client-list',
          bind: { clients: 'clientsList' },
        },
        deal: {
          type: 'fx-spot-deal',
          bind: {
            clientCode: 'selectedClient.code',
            clientName: 'selectedClient.name',
            spot: 'spotUsdPln',
          },
        },
      },
      eventHandlers: [
        { on: 'clients.select', do: [{ setDatasource: 'selectedClient', from: '$event' }] },
        { on: 'deal.submit', do: [
          { setDatasource: 'dealResult', from: '$event' },
          { emit: 'fx.spot.deal.completed', payload: '$event' },
        ] },
        { on: 'deal.rfqAccept', do: [
          { setDatasource: 'dealResult', from: '$event' },
          { emit: 'fx.spot.rfq.accepted', payload: '$event' },
        ] },
      ],
    } as PageConfig['page'],
  };

  store.upsert({
    id: 'fx-spot',
    title: 'FX Spot Deal',
    route: '/fx-spot',
    config,
    className: 'FxSpotPage',
  });
}

function seedFxSpotForm(store: DraftFormStoreService): void {
  if (store.get('fx-spot-transaction')) return;

  store.upsert({
    id: 'fx-spot-transaction',
    title: 'Transakcja FX Spot',
    description: 'Formularz dealerski — live pricing + tryb RFQ przy przekroczeniu limitu.',
    submitLabel: 'Zatwierdź transakcję',
    requires: [
      'clientData',
      'clientUsers',
      'clientAccounts',
      'currencyPairs',
      'spotPricing',
      'clientLimits',
      'rfqResponse',
    ],
    emits: [
      { event: 'fx-spot.params-changed', description: 'Parametry zmieniły się — odśwież WS pricing' },
      { event: 'fx-spot.submitted', description: 'Transakcja zatwierdzona (tryb normalny)' },
      { event: 'fx-spot.stream-pause', description: 'Wejście w RFQ — rozłącz WS' },
      { event: 'fx-spot.stream-resume', description: 'Powrót z RFQ — wznów WS' },
      { event: 'fx-spot.rfq-requested', description: 'Wyślij zapytanie o cenę RFQ' },
      { event: 'fx-spot.rfq-accepted', description: 'Zaakceptowano cenę RFQ → booking' },
      { event: 'fx-spot.rfq-rejected', description: 'Odrzucono cenę RFQ — czekaj na akcję' },
      { event: 'fx-spot.cancelled', description: 'Anulowanie transakcji' },
    ],
    fields: [
      { id: 'clientName', label: 'Klient', type: 'text', width: 6 },
      { id: 'userId', label: 'User (przypisany)', type: 'select', required: true, width: 6, options: [] },
      { id: 'currencyPair', label: 'Para walutowa', type: 'select', required: true, width: 3,
        options: [
          { value: 'USDPLN', label: 'USD/PLN' }, { value: 'EURPLN', label: 'EUR/PLN' },
          { value: 'GBPPLN', label: 'GBP/PLN' }, { value: 'CHFPLN', label: 'CHF/PLN' },
          { value: 'EURUSD', label: 'EUR/USD' },
        ],
        actions: { onChange: [{ emit: 'fx-spot.params-changed' }] },
      },
      { id: 'valueDate', label: 'Data waluty', type: 'date', required: true, width: 3,
        actions: { onChange: [{ emit: 'fx-spot.params-changed' }] },
      },
      { id: 'dealType', label: 'Typ (TODAY/TOM/SPOT/FWD)', type: 'text', width: 3 },
      { id: 'side', label: 'Operacja', type: 'select', required: true, width: 3,
        options: [{ value: 'SELL', label: 'Sprzedaj' }, { value: 'BUY', label: 'Kupuj' }],
        actions: { onChange: [{ emit: 'fx-spot.params-changed' }] },
      },
      { id: 'dealCurrency', label: 'Waluta transakcji', type: 'select', required: true, width: 3, options: [] },
      { id: 'amount', label: 'Kwota', type: 'decimal', required: true, width: 3, min: 0.01,
        actions: {
          onChange: [{ emit: 'fx-spot.params-changed' }],
          onBlur: [{ emit: 'fx-spot.params-changed' }],
        },
      },
      { id: 'spotRate', label: 'Kurs spot', type: 'decimal', width: 3 },
      { id: 'refRate', label: 'Kurs referencyjny', type: 'decimal', width: 3 },
      { id: 'txRate', label: 'Kurs transakcyjny', type: 'decimal', width: 3 },
      { id: 'profitPln', label: 'Profit (PLN)', type: 'decimal', width: 3 },
      { id: 'swapPoints', label: 'Punkty swap', type: 'decimal', width: 3 },
      { id: 'clientMarginPips', label: 'Marża (pips)', type: 'decimal', width: 3 },
      { id: 'clientMarginPct', label: 'Marża (%)', type: 'decimal', width: 3 },
      { id: 'discountedProfitPln', label: 'Profit zdyskontowany (PLN)', type: 'decimal', width: 3 },
      { id: 'sourceAccount', label: 'Rachunek źródłowy', type: 'select', required: true, width: 6, options: [] },
      { id: 'targetAccount', label: 'Rachunek docelowy', type: 'select', required: true, width: 6, options: [] },
      { id: 'rfqMode', label: 'Tryb RFQ', type: 'checkbox', width: 2 },
      { id: 'rfqStatus', label: 'Status RFQ', type: 'text', width: 4 },
      { id: 'rfqPrice', label: 'Cena z RFQ', type: 'decimal', width: 3 },
      { id: 'rfqValidUntil', label: 'Ważne do (TTL)', type: 'text', width: 3 },
      { id: 'rfqComment', label: 'Komentarz RFQ', type: 'textarea', width: 12 },
    ],
  });
}

function seedFxSpotDealForm(store: DraftFormStoreService): void {
  if (store.get('fx-spot-deal-widget')) return;

  store.upsert({
    id: 'fx-spot-deal-widget',
    title: 'FX Spot Deal — Widget (fx-spot-deal)',
    description: 'Manifest widgetu fx-spot-deal — pełny flow: live pricing → RFQ → booking → sukces/error.',
    submitLabel: 'Zatwierdź transakcję',
    requires: [
      'clientCode — kod klienta (string, bind z selectedClient.code)',
      'clientName — nazwa klienta (string, bind z selectedClient.name)',
      'spot — live bid/ask z WS stream (object {bid, ask})',
      'rfqResponse — odpowiedź RFQ z serwera (object {status, price, refRate, validUntil})',
    ],
    emits: [
      { event: 'submit', description: 'Transakcja zaksięgowana — payload: pełne dane + bookingRef' },
      { event: 'rfqRequest', description: 'Wyślij RFQ request (pair, side, amount, date, client)' },
      { event: 'rfqAccept', description: 'Zaakceptowano cenę RFQ → booking z rfqPrice' },
      { event: 'rfqReject', description: 'Odrzucono cenę RFQ' },
      { event: 'paramsChanged', description: 'Parametry zmieniły się — odśwież WS stream' },
    ],
    fields: [
      { id: 'pair', label: 'Para walutowa', type: 'select', required: true, width: 6 },
      { id: 'side', label: 'Operacja (BUY/SELL)', type: 'select', required: true, width: 6 },
      { id: 'amount', label: 'Kwota', type: 'decimal', required: true, width: 6 },
      { id: 'valueDate', label: 'Data waluty', type: 'date', width: 6 },
      { id: 'marginPips', label: 'Marża (pips)', type: 'number', width: 6 },
      { id: 'dealType', label: 'Typ (computed z daty)', type: 'text', width: 6 },
    ],
  });
}

function seedFxSpotFormPage(store: DraftPageStoreService): void {
  if (store.get('fx-spot-form-page')) return;

  const config: PageConfig = {
    $schemaVersion: '2026.04-alpha' as PageConfig['$schemaVersion'],
    page: {
      id: 'fx-spot-form-page',
      title: 'FX Spot — Formularz (form-ref)',
      datasources: {
        clientsList: {},
        spotUsdPln: {},
        selectedClient: { kind: 'local', initial: null },
      },
      layout: {
        type: 'grid',
        cols: 12,
        items: [
          { widget: 'title', x: 0, y: 0, w: 12 },
          { widget: 'clients', x: 0, y: 1, w: 3, h: 10 },
          { widget: 'txForm', x: 3, y: 1, w: 9, h: 10 },
        ],
      },
      widgets: {
        title: {
          type: 'page-title',
          options: { title: 'FX Spot — via form-ref', subtitle: 'Standalone formularz osadzony przez referencję' },
        },
        clients: {
          type: 'client-list',
          bind: { clients: 'clientsList' },
        },
        txForm: {
          type: 'form-ref',
          options: { formId: 'fx-spot-transaction' },
        },
      },
      eventHandlers: [
        { on: 'clients.select', do: [{ setDatasource: 'selectedClient', from: '$event' }] },
        { on: 'txForm.submit', do: [{ emit: 'fx.spot.form-ref.submitted', payload: '$event' }] },
      ],
    } as PageConfig['page'],
  };

  store.upsert({
    id: 'fx-spot-form-page',
    title: 'FX Spot — Formularz (form-ref)',
    route: '/fx-spot-form',
    config,
    className: 'FxSpotFormPage',
  });
}
