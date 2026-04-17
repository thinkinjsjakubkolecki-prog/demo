/**
 * Formularz transakcji FX Spot — seed do DraftFormStore.
 *
 * Silnie izolowany komponent: nie wie na jakiej stronie się pojawi.
 * Deklaruje kontrakt (requires/emits) — rodzic podpina dane i reaguje.
 *
 * ═══ FLOW NORMALNY (kwota w limicie) ═══
 *   1. Rodzic dostarcza clientData, clientUsers, clientAccounts, currencyPairs
 *   2. User wypełnia parametry → emit fx-spot.params-changed
 *   3. Rodzic podpina websocket spotPricing → reaguje na params-changed
 *   4. WS pushuje live: spotRate, refRate, txRate, profitPln, swapPoints, margins
 *   5. User zatwierdza → emit fx-spot.submitted
 *   6. Rodzic commituje: fetch(transaction.create, $form.values)
 *
 * ═══ FLOW RFQ (kwota > limit) ═══
 *   1. amount > clientLimits.maxSpotAmount → rfqMode = true
 *   2. User klika "Wyślij zapytanie RFQ" → emit fx-spot.rfq-requested
 *   3. Rodzic robi: fetch(rfq.request, { pair, side, amount, date, client })
 *   4. Serwer zwraca cenę → rodzic pushuje do $ds.rfqResponse
 *   5. rfqStatus = 'price-received', rfqPrice wypełnione, rfqValidUntil = TTL
 *   6. User akceptuje → emit fx-spot.rfq-accepted (rodzic commituje z rfqPrice)
 *      LUB odrzuca → emit fx-spot.rfq-rejected (wraca do edycji)
 *      LUB TTL wygasa → rfqStatus = 'expired' (musi ponownie requestować)
 */
import { inject } from '@angular/core';
import { DraftFormStoreService, type DraftForm } from '../services/draft-form-store.service';

const FORM_ID = 'fx-spot-transaction';

const FX_SPOT_FORM: Omit<DraftForm, 'createdAt' | 'updatedAt'> = {
  id: FORM_ID,
  title: 'Transakcja FX Spot',
  description: 'Formularz dealerski do zawierania transakcji spot/today/tom/forward z live pricing z websocketu. Przy przekroczeniu limitu przechodzi w tryb RFQ.',

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
    { event: 'fx-spot.params-changed', description: 'Parametry się zmieniły (pair/amount/side/date) — rodzic aktualizuje websocket pricing stream' },
    { event: 'fx-spot.submitted', description: 'Transakcja zatwierdzona w trybie normalnym (kwota w limicie) — payload: pełne wartości' },
    { event: 'fx-spot.rfq-requested', description: 'Kwota > limit → wyślij zapytanie RFQ do serwera z parametrami (pair, side, amount, date). Rodzic robi fetch → czeka na odpowiedź → pushuje do rfqResponse' },
    { event: 'fx-spot.rfq-accepted', description: 'Dealer zaakceptował cenę z RFQ — payload: wartości + rfqPrice. Rodzic commituje transakcję.' },
    { event: 'fx-spot.rfq-rejected', description: 'Dealer odrzucił cenę z RFQ — wraca do edycji parametrów' },
    { event: 'fx-spot.cancelled', description: 'User anulował transakcję' },
  ],

  submitLabel: 'Zatwierdź transakcję',

  fields: [
    // ── Sekcja: Klient ──────────────────────────────────────────────────
    {
      id: 'clientName',
      label: 'Klient',
      type: 'text',
      placeholder: 'Nazwa klienta (od rodzica)',
      width: 6,
    },
    {
      id: 'userId',
      label: 'User (przypisany do klienta)',
      type: 'select',
      required: true,
      width: 6,
      options: [],
      // Runtime: rodzic binduje options → $ds.clientUsers (lista {value, label})
    },

    // ── Sekcja: Parametry transakcji ────────────────────────────────────
    {
      id: 'currencyPair',
      label: 'Para walutowa',
      type: 'select',
      required: true,
      width: 3,
      options: [
        { value: 'USDPLN', label: 'USD/PLN' },
        { value: 'EURPLN', label: 'EUR/PLN' },
        { value: 'GBPPLN', label: 'GBP/PLN' },
        { value: 'CHFPLN', label: 'CHF/PLN' },
        { value: 'EURUSD', label: 'EUR/USD' },
        { value: 'GBPUSD', label: 'GBP/USD' },
        { value: 'USDCHF', label: 'USD/CHF' },
        { value: 'EURCHF', label: 'EUR/CHF' },
      ],
      actions: {
        onChange: [{ emit: 'fx-spot.params-changed' }],
      },
    },
    {
      id: 'valueDate',
      label: 'Data waluty',
      type: 'date',
      required: true,
      width: 3,
      actions: {
        onChange: [{ emit: 'fx-spot.params-changed' }],
      },
    },
    {
      id: 'dealType',
      label: 'Typ (computed z daty)',
      type: 'text',
      placeholder: 'TODAY / TOM / SPOT / FWD',
      width: 3,
      // Readonly — computed po stronie rodzica z valueDate vs today.
      // Rodzic binduje: dealType ← $computed.resolveDealType(valueDate)
    },
    {
      id: 'side',
      label: 'Operacja',
      type: 'select',
      required: true,
      width: 3,
      options: [
        { value: 'SELL', label: 'Sprzedaj (SELL)' },
        { value: 'BUY', label: 'Kupuj (BUY)' },
      ],
      // Default: SELL (pierwsze w liście)
      actions: {
        onChange: [{ emit: 'fx-spot.params-changed' }],
      },
    },
    {
      id: 'dealCurrency',
      label: 'Waluta transakcji',
      type: 'select',
      required: true,
      width: 3,
      options: [],
      // Runtime: rodzic aktualizuje options na podstawie wybranej pary.
      // Dla USDPLN → [{value:'USD', label:'USD'}, {value:'PLN', label:'PLN'}]
    },
    {
      id: 'amount',
      label: 'Kwota',
      type: 'decimal',
      required: true,
      placeholder: '100 000.00',
      min: 0.01,
      width: 3,
      actions: {
        onChange: [{ emit: 'fx-spot.params-changed' }],
        onBlur: [{ emit: 'fx-spot.params-changed' }],
        // Rodzic na fx-spot.params-changed sprawdza limit i jeśli amount > limit
        // emituje fx-spot.rfq-requested. Alternatywnie: formularz sam to robi
        // (wymaga dostępu do $ds.clientLimits — requires).
      },
    },

    // ── Sekcja: Pricing (readonly, z websocketu) ────────────────────────
    {
      id: 'spotRate',
      label: 'Kurs spot',
      type: 'decimal',
      placeholder: '—',
      width: 3,
      // Bind: $ds.spotPricing.spotRate
    },
    {
      id: 'refRate',
      label: 'Kurs referencyjny',
      type: 'decimal',
      placeholder: '—',
      width: 3,
      // Bind: $ds.spotPricing.refRate
    },
    {
      id: 'txRate',
      label: 'Kurs transakcyjny',
      type: 'decimal',
      placeholder: '—',
      width: 3,
      // Bind: $ds.spotPricing.txRate
    },
    {
      id: 'profitPln',
      label: 'Profit (PLN)',
      type: 'decimal',
      placeholder: '—',
      width: 3,
      // Bind: $ds.spotPricing.profitPln
    },
    {
      id: 'swapPoints',
      label: 'Punkty swap',
      type: 'decimal',
      placeholder: '—',
      width: 3,
      // Bind: $ds.spotPricing.swapPoints (> 0 dla TOM/SPOT/FWD)
    },
    {
      id: 'clientMarginPips',
      label: 'Marża klienta (pips)',
      type: 'decimal',
      placeholder: '—',
      width: 3,
      // Bind: $ds.spotPricing.clientMarginPips
      // Edytowalne przez dealera w trybie override
    },
    {
      id: 'clientMarginPct',
      label: 'Marża klienta (%)',
      type: 'decimal',
      placeholder: '—',
      width: 3,
      // Bind: $ds.spotPricing.clientMarginPct
    },
    {
      id: 'discountedProfitPln',
      label: 'Profit zdyskontowany (PLN)',
      type: 'decimal',
      placeholder: '—',
      width: 3,
      // Bind: $ds.spotPricing.discountedProfitPln
    },

    // ── Sekcja: Rachunki ────────────────────────────────────────────────
    {
      id: 'sourceAccount',
      label: 'Rachunek źródłowy',
      type: 'select',
      required: true,
      width: 6,
      options: [],
      // Runtime: rodzic binduje options → $ds.clientAccounts (filtered by dealCurrency)
    },
    {
      id: 'targetAccount',
      label: 'Rachunek docelowy',
      type: 'select',
      required: true,
      width: 6,
      options: [],
      // Runtime: rodzic binduje options → $ds.clientAccounts (counterpart currency)
    },

    // ── Sekcja: RFQ (widoczne gdy limit przekroczony) ─────────────────
    //
    // Flow RFQ:
    //   1. amount > limit → rfqMode = true (readonly, set by parent)
    //   2. User klika "Wyślij zapytanie RFQ" → emit fx-spot.rfq-requested
    //   3. Rodzic robi fetch(rfq.request, params) → czeka na response
    //   4. Serwer odpowiada ceną → rodzic pushuje do $ds.rfqResponse
    //   5. rfqStatus zmienia się na 'price-received'
    //   6. Pola rfqPrice/rfqValidUntil wypełnione
    //   7. User klika "Akceptuj cenę" → emit fx-spot.rfq-accepted
    //      LUB "Odrzuć" → emit fx-spot.rfq-rejected → wraca do edycji
    //
    {
      id: 'rfqMode',
      label: 'Tryb RFQ',
      type: 'checkbox',
      width: 2,
      // Readonly — ustawiany przez rodzica gdy amount > clientLimits.maxSpotAmount
    },
    {
      id: 'rfqStatus',
      label: 'Status RFQ',
      type: 'text',
      placeholder: 'idle / pending / price-received / accepted / rejected / expired',
      width: 4,
      // Readonly — computed: idle → pending (po request) → price-received (od serwera)
      //   → accepted/rejected (po akcji usera)
      // Bind: $ds.rfqResponse.status
    },
    {
      id: 'rfqPrice',
      label: 'Cena z RFQ',
      type: 'decimal',
      placeholder: '— czekam na odpowiedź —',
      width: 3,
      // Readonly — Bind: $ds.rfqResponse.price
      // Widoczne gdy rfqStatus === 'price-received'
    },
    {
      id: 'rfqValidUntil',
      label: 'Ważne do',
      type: 'text',
      placeholder: 'TTL ceny',
      width: 3,
      // Readonly — Bind: $ds.rfqResponse.validUntil (np. "15s", countdown)
    },
    {
      id: 'rfqComment',
      label: 'Komentarz RFQ (opcjonalny)',
      type: 'textarea',
      placeholder: 'Uzasadnienie dla kwoty powyżej limitu...',
      width: 12,
    },
  ],
};

/**
 * Seed — importowany w bootstrap, zapisuje formularz do DraftFormStore
 * jeśli jeszcze nie istnieje. Idempotentny.
 */
export function seedFxSpotForm(formStore: DraftFormStoreService): void {
  if (formStore.get(FORM_ID)) return;
  formStore.upsert(FX_SPOT_FORM);
}
