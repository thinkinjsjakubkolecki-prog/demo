/**
 * Nowa transakcja — wieloetapowy wizard (ProcessBuilder).
 *
 * 3 kroki:
 *   1. Klient — wybór klienta (clientName, clientId)
 *   2. Parametry — kwota, strona, para walutowa
 *   3. Przegląd + Zatwierdzenie — podsumowanie + atomic commit (fetch)
 *
 * State akumulowany w session DataSource 'txDraft' (przeżywa nawigację).
 * Commit na step 3 = fetch('rfq.send', $ds.txDraft) + navigate done.
 */
import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';
import type { PageConfig, EventAction } from '@echelon-framework/core';

// ─── Step configs (ręcznie — bo ProcessBuilder jeszcze nie w dist) ─────────

const SESSION_KEY = 'txDraft';
const PROCESS_ID = 'new-tx';

function stepRoute(stepId: string): string {
  return `/process/${PROCESS_ID}/${stepId}`;
}

// Step 1 — Klient
const step1Config = PageBuilder.create(`${PROCESS_ID}-client`)
  .title('Nowa transakcja — Krok 1: Klient')
  .local(SESSION_KEY, {})
  .widget('step-header', { x: 0, y: 0, w: 12 },
    widget.any('page-title', { options: { title: 'Krok 1 — Wybierz klienta' } }))
  .widget('clientForm', { x: 0, y: 1, w: 12, h: 8 },
    widget.any('advanced-form', {
      bind: { initial: `$ds.${SESSION_KEY}` },
      options: {
        submitLabel: 'Dalej →',
        fields: [
          { id: 'clientName', label: 'Nazwa klienta', type: 'text', required: true, placeholder: 'np. Acme Corp' },
          { id: 'clientId', label: 'ID klienta', type: 'text', placeholder: 'np. CLI-001' },
          { id: 'clientType', label: 'Typ klienta', type: 'select',
            options: [
              { value: 'corporate', label: 'Korporacyjny' },
              { value: 'individual', label: 'Indywidualny' },
              { value: 'bank', label: 'Bank / Instytucja' },
            ] },
        ],
      },
    }))
  .handler('clientForm.submit', [
    { mergeDatasource: SESSION_KEY, from: '$event' } as EventAction,
    { navigate: stepRoute('params') } as unknown as EventAction,
  ])
  .build();

// Step 2 — Parametry transakcji
const step2Config = PageBuilder.create(`${PROCESS_ID}-params`)
  .title('Nowa transakcja — Krok 2: Parametry')
  .local(SESSION_KEY, {})
  .widget('step-header', { x: 0, y: 0, w: 12 },
    widget.any('page-title', { options: { title: 'Krok 2 — Parametry transakcji' } }))
  .widget('paramsForm', { x: 0, y: 1, w: 12, h: 8 },
    widget.any('advanced-form', {
      bind: { initial: `$ds.${SESSION_KEY}` },
      options: {
        submitLabel: 'Dalej →',
        fields: [
          { id: 'currencyPair', label: 'Para walutowa', type: 'select', required: true,
            options: [
              { value: 'USDPLN', label: 'USD/PLN' },
              { value: 'EURPLN', label: 'EUR/PLN' },
              { value: 'GBPPLN', label: 'GBP/PLN' },
              { value: 'EURUSD', label: 'EUR/USD' },
            ] },
          { id: 'side', label: 'Strona', type: 'select', required: true,
            options: [
              { value: 'BUY', label: 'Kupuj (BUY)' },
              { value: 'SELL', label: 'Sprzedaj (SELL)' },
            ] },
          { id: 'amount', label: 'Kwota (nominał)', type: 'number', required: true, placeholder: '100000' },
          { id: 'valueDate', label: 'Data waluty', type: 'date' },
          { id: 'marginPips', label: 'Marża (pips)', type: 'number', placeholder: '5' },
        ],
      },
    }))
  .handler('paramsForm.submit', [
    { mergeDatasource: SESSION_KEY, from: '$event' } as EventAction,
    { navigate: stepRoute('review') } as unknown as EventAction,
  ])
  .build();

// Step 3 — Przegląd + Zatwierdzenie
const step3Config = PageBuilder.create(`${PROCESS_ID}-review`)
  .title('Nowa transakcja — Krok 3: Przegląd')
  .local(SESSION_KEY, {})
  .widget('step-header', { x: 0, y: 0, w: 12 },
    widget.any('page-title', { options: { title: 'Krok 3 — Przegląd i zatwierdzenie' } }))
  .widget('summary', { x: 0, y: 1, w: 12, h: 6 },
    widget.any('process-summary', {
      bind: { data: `$ds.${SESSION_KEY}` },
      options: { title: 'Podsumowanie transakcji' },
    }))
  .widget('commit-bar', { x: 0, y: 7, w: 12, h: 2 },
    widget.any('actions-bar', {
      options: {
        actions: [
          { id: 'commit', label: '✓ Zatwierdź transakcję', variant: 'primary' },
          { id: 'back', label: '← Wróć', variant: 'secondary' },
        ],
      },
    }))
  .handler('commit-bar.actionClick', [
    { emit: 'fx.rfq.submitted', payload: `$ds.${SESSION_KEY}` } as unknown as EventAction,
    { clearDatasource: SESSION_KEY } as EventAction,
    { navigate: stepRoute('done') } as unknown as EventAction,
  ], { eq: 'commit' })
  .handler('commit-bar.actionClick', [
    { navigate: stepRoute('params') } as unknown as EventAction,
  ], { eq: 'back' })
  .build();

// Step 4 — Gotowe
const step4Config = PageBuilder.create(`${PROCESS_ID}-done`)
  .title('Nowa transakcja — Gotowe')
  .widget('step-header', { x: 0, y: 0, w: 12 },
    widget.any('page-title', { options: { title: 'Transakcja została wysłana' } }))
  .widget('info', { x: 0, y: 1, w: 12, h: 3 },
    widget.any('section-header', {
      options: { title: 'Zlecenie RFQ zostało przesłane do realizacji. Otrzymasz potwierdzenie na maila.' },
    }))
  .widget('new-btn', { x: 0, y: 4, w: 4, h: 2 },
    widget.any('actions-bar', {
      options: {
        actions: [
          { id: 'restart', label: '+ Nowa transakcja', variant: 'primary' },
        ],
      },
    }))
  .handler('new-btn.actionClick', [
    { navigate: stepRoute('client') } as unknown as EventAction,
  ])
  .build();

// ─── @Page registrations ─────────────────────────────────────────────────────

@Page({ route: stepRoute('client'), title: 'Nowa transakcja — Klient' })
export class NewTxStep1Page {
  static readonly config: PageConfig = step1Config;
}

@Page({ route: stepRoute('params'), title: 'Nowa transakcja — Parametry' })
export class NewTxStep2Page {
  static readonly config: PageConfig = step2Config;
}

@Page({ route: stepRoute('review'), title: 'Nowa transakcja — Przegląd' })
export class NewTxStep3Page {
  static readonly config: PageConfig = step3Config;
}

@Page({ route: stepRoute('done'), title: 'Nowa transakcja — Gotowe' })
export class NewTxStep4Page {
  static readonly config: PageConfig = step4Config;
}
