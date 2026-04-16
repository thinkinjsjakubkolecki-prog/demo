/**
 * Katalog 5 typów transakcji FX + definicje pól.
 * Używane przez:
 *  - `new-transaction.page.ts` — renderuje validated-form wg `txType` routeParam
 *  - `tabs.ts` (tab Transakcje FX) — action-bar buttons z `id` = tx type
 */

export type TxField = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  options?: ReadonlyArray<{ value: string; label: string }>;
  section: string;
  width?: number;
};

const F = (id: string, label: string, section: string,
           type: TxField['type'] = 'text',
           extra?: Partial<TxField>): TxField => ({ id, label, section, type, ...extra });

const PAIR_OPTIONS = [
  { value: 'EUR/PLN', label: 'EUR/PLN' }, { value: 'USD/PLN', label: 'USD/PLN' },
  { value: 'GBP/PLN', label: 'GBP/PLN' }, { value: 'CHF/PLN', label: 'CHF/PLN' },
  { value: 'EUR/USD', label: 'EUR/USD' }, { value: 'GBP/USD', label: 'GBP/USD' },
];
const SIDE_OPTIONS = [{ value: 'BUY', label: 'KUPNO' }, { value: 'SELL', label: 'SPRZEDAŻ' }];
const PRICE_SRC = [
  { value: 'EBS', label: 'EBS' }, { value: 'REUTERS', label: 'Reuters' }, { value: 'INTERNAL', label: 'Wewnętrzny' },
];

const COMPLIANCE: TxField[] = [
  F('mifid',    'MIFID',                         'Compliance & e-confirm', 'checkbox'),
  F('exAnte',   'EX-ANTE',                       'Compliance & e-confirm', 'checkbox'),
  F('kyc',      'KYC potwierdzony',              'Compliance & e-confirm', 'checkbox'),
  F('aml',      'AML potwierdzony',              'Compliance & e-confirm', 'checkbox'),
  F('eConfirm', 'Potwierdzenie elektroniczne',   'Compliance & e-confirm', 'checkbox'),
];
const SETTLEMENT: TxField[] = [
  F('srcAccount', 'Rachunek źródłowy', 'Rozliczenie'),
  F('dstAccount', 'Rachunek docelowy', 'Rozliczenie'),
];
const NOTES: TxField[] = [F('note', 'Notatka dealera', 'Notatki')];

const FX_FIELDS: TxField[] = [
  F('tradeKind',   'Rodzaj',              'Identyfikacja', 'select',
    { options: [{ value: 'TODAY', label: 'TODAY' }, { value: 'SPOT', label: 'SPOT' }, { value: 'FORWARD', label: 'FORWARD' }] }),
  F('dealer',      'Dealer',              'Identyfikacja'),
  F('currencyPair','Para walutowa',       'Parametry', 'select', { options: PAIR_OPTIONS }),
  F('side',        'Strona',              'Parametry', 'select', { options: SIDE_OPTIONS }),
  F('amount',      'Kwota',               'Parametry', 'number'),
  F('counterAmount','Kwota counter (auto)','Parametry', 'number'),
  F('valueDate',   'Data waluty',         'Parametry', 'date'),
  F('tenor',       'Tenor (FORWARD)',     'Parametry'),
  F('refRate',     'Kurs referencyjny',   'Wycena', 'number'),
  F('marginPips',  'Marża (pips)',        'Wycena', 'number'),
  F('effectiveRate','Kurs efektywny',     'Wycena', 'number'),
  F('swapPoints',  'Punkty SWAP (FORWARD)','Wycena', 'number'),
  F('priceSource', 'Źródło kursu',        'Wycena', 'select', { options: PRICE_SRC }),
  ...SETTLEMENT, ...COMPLIANCE, ...NOTES,
];

const SWAP_FIELDS: TxField[] = [
  F('swapType',    'Rodzaj swap',          'Identyfikacja', 'select',
    { options: [{ value: 'BUY-SELL', label: 'BUY-SELL' }, { value: 'SELL-BUY', label: 'SELL-BUY' }] }),
  F('dealer',      'Dealer',               'Identyfikacja'),
  F('currencyPair','Para walutowa',        'Para', 'select', { options: PAIR_OPTIONS }),
  F('nearAmount',  'Kwota — noga bliższa', 'Noga bliższa', 'number'),
  F('nearValueDate','Data waluty — bliższa','Noga bliższa', 'date'),
  F('nearRate',    'Kurs — bliższa',       'Noga bliższa', 'number'),
  F('farAmount',   'Kwota — noga dalsza',  'Noga dalsza', 'number'),
  F('farValueDate','Data waluty — dalsza', 'Noga dalsza', 'date'),
  F('farRate',     'Kurs — dalsza',        'Noga dalsza', 'number'),
  F('swapPoints',  'Punkty swap',          'Punkty i marża', 'number'),
  F('marginPips',  'Marża (pips)',         'Punkty i marża', 'number'),
  ...SETTLEMENT, ...COMPLIANCE, ...NOTES,
];

const SPOT_PAY_FIELDS: TxField[] = [
  F('paymentPurpose','Cel płatności',    'Identyfikacja'),
  F('dealer',        'Dealer',           'Identyfikacja'),
  F('currencyPair',  'Para walutowa',    'Parametry', 'select', { options: PAIR_OPTIONS }),
  F('side',          'Strona',           'Parametry', 'select', { options: SIDE_OPTIONS }),
  F('amount',        'Kwota',            'Parametry', 'number'),
  F('valueDate',     'Data waluty',      'Parametry', 'date'),
  F('refRate',       'Kurs referencyjny','Wycena', 'number'),
  F('marginPips',    'Marża (pips)',     'Wycena', 'number'),
  F('effectiveRate', 'Kurs efektywny',   'Wycena', 'number'),
  F('srcAccount',    'Rachunek źródłowy','Rachunek'),
  F('beneficiaryName',   'Nazwa beneficjenta', 'Beneficjent'),
  F('beneficiaryIban',   'IBAN beneficjenta',  'Beneficjent'),
  F('beneficiaryBic',    'BIC',                'Beneficjent'),
  F('beneficiaryCountry','Kraj beneficjenta',  'Beneficjent'),
  F('beneficiaryAddress','Adres beneficjenta', 'Beneficjent'),
  F('paymentTitle',     'Tytuł płatności',     'Tytuł'),
  F('paymentReference', 'Referencja',          'Tytuł'),
  ...COMPLIANCE, ...NOTES,
];

const MULTI_FWD_FIELDS: TxField[] = [
  F('contractRef', 'Ref. kontraktu', 'Identyfikacja'),
  F('dealer',      'Dealer',         'Identyfikacja'),
  F('currencyPair','Para walutowa',  'Para', 'select', { options: PAIR_OPTIONS }),
  F('side',        'Strona',         'Para', 'select', { options: SIDE_OPTIONS }),
  F('leg1Amount',  'Noga 1: kwota',  'Noga 1', 'number'),
  F('leg1ValueDate','Noga 1: data',  'Noga 1', 'date'),
  F('leg1Rate',    'Noga 1: kurs',   'Noga 1', 'number'),
  F('leg2Amount',  'Noga 2: kwota',  'Noga 2', 'number'),
  F('leg2ValueDate','Noga 2: data',  'Noga 2', 'date'),
  F('leg2Rate',    'Noga 2: kurs',   'Noga 2', 'number'),
  F('leg3Amount',  'Noga 3: kwota',  'Noga 3', 'number'),
  F('leg3ValueDate','Noga 3: data',  'Noga 3', 'date'),
  F('leg3Rate',    'Noga 3: kurs',   'Noga 3', 'number'),
  F('totalAmount', 'Suma kwot (auto)','Wycena', 'number'),
  F('marginPips',  'Marża (pips)',   'Wycena', 'number'),
  ...SETTLEMENT, ...COMPLIANCE, ...NOTES,
];

const PAR_FWD_FIELDS: TxField[] = [
  F('contractName',    'Nazwa kontraktu',      'Identyfikacja'),
  F('dealer',          'Dealer',               'Identyfikacja'),
  F('currencyPair',    'Para walutowa',        'Parametry', 'select', { options: PAIR_OPTIONS }),
  F('side',            'Strona',               'Parametry', 'select', { options: SIDE_OPTIONS }),
  F('totalAmount',     'Łączna kwota',         'Parametry', 'number'),
  F('installmentsCount','Liczba rat',          'Parametry', 'number'),
  F('frequency',       'Częstotliwość',        'Parametry', 'select',
    { options: [{ value: 'M', label: 'Miesięczna' }, { value: 'Q', label: 'Kwartalna' }, { value: 'Y', label: 'Roczna' }] }),
  F('firstValueDate',  'Pierwsza data waluty', 'Parametry', 'date'),
  F('parRate',         'Par rate',             'Wycena', 'number'),
  F('marginPips',      'Marża (pips)',         'Wycena', 'number'),
  ...SETTLEMENT, ...COMPLIANCE, ...NOTES,
];

export interface TxTypeSpec {
  readonly id: string;
  readonly label: string;
  readonly fields: ReadonlyArray<TxField>;
}

export const TX_TYPES: ReadonlyArray<TxTypeSpec> = [
  { id: 'fx',        label: 'Transakcja FX',    fields: FX_FIELDS },
  { id: 'swap',      label: 'SWAP',             fields: SWAP_FIELDS },
  { id: 'spot-pay',  label: 'SPOT for Payment', fields: SPOT_PAY_FIELDS },
  { id: 'multi-fwd', label: 'MULTIFORWARD',     fields: MULTI_FWD_FIELDS },
  { id: 'par-fwd',   label: 'PARFORWARD',       fields: PAR_FWD_FIELDS },
];

export function sectionsOf(fields: ReadonlyArray<TxField>): ReadonlyArray<{ id: string; title: string; collapsible: boolean }> {
  const seen = new Set<string>();
  const out: { id: string; title: string; collapsible: boolean }[] = [];
  for (const f of fields) { if (!seen.has(f.section)) { seen.add(f.section); out.push({ id: f.section, title: f.section, collapsible: true }); } }
  return out;
}
