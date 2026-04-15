/**
 * Endpoint handlers — używane przez mock transport.
 * Każdy klucz = `channel` w fetch action; wartość = funkcja `(params, ctx) => data`.
 */

export const endpoints = {
  /**
   * Resolver pełnego rekordu klienta po `code` (z URL routeParams.entityId).
   * Backend zwraca rich model (entity/dealer/uscrs/customerAccounts/...);
   * tu mockujemy syntezując dane na podstawie krótkiego rekordu z listy.
   */
  /** Dealer details — chained endpoint w demo Aggregate. */
  'dealer-by-adname': async (params: Record<string, unknown>): Promise<unknown> => {
    const adname = String(params['adname'] ?? '');
    return {
      adname,
      firstName: 'Michał',
      lastName:  'Łój',
      email:     `${adname}@bank.example.com`,
      phone:     '+48 600 000 000',
    };
  },

  /** Marże klienta — zwraca tablicę {currency, bps}. */
  'client-margins': async (params: Record<string, unknown>): Promise<unknown> => {
    const id = String(params['clientId'] ?? params['id'] ?? '');
    void id;
    return [
      { currency: 'EUR', bps: 25 },
      { currency: 'USD', bps: 30 },
      { currency: 'CHF', bps: 35 },
      { currency: 'GBP', bps: 28 },
    ];
  },

  /** Konta klienta — zwraca tablicę kont z IBAN. */
  'client-accounts': async (params: Record<string, unknown>): Promise<unknown> => {
    const id = String(params['clientId'] ?? params['id'] ?? '');
    const pad = id.padStart(6, '0');
    return [
      { id: `2339 ${pad} 001`, iban: `PL28160011720002339${pad}001`, accountType: 'CA',     currency: 'PLN',
        default: true,  pending: false, closed: false, balance: 1_245_678.42, openedAt: '2018-03-12', branch: '8897', label: 'Główne PLN' },
      { id: `2339 ${pad} 002`, iban: `DE89370400440532013${pad}`,    accountType: 'CA',     currency: 'EUR',
        default: false, pending: false, closed: false, balance: 89_432.10,    openedAt: '2019-07-22', branch: '8897', label: 'EUR — operacyjne' },
      { id: `2339 ${pad} 003`, iban: `GB29NWBK60161331926${pad}`,    accountType: 'INV',    currency: 'GBP',
        default: false, pending: true,  closed: false, balance: 0,            openedAt: '2026-04-10', branch: '4412', label: 'Inwestycyjne GBP (zakładane)' },
      { id: `2339 ${pad} 004`, iban: `CH9300762011623852${pad}`,     accountType: 'CA',     currency: 'CHF',
        default: false, pending: false, closed: false, balance: 23_120.00,    openedAt: '2020-11-05', branch: '8897', label: 'CHF — depozyty' },
      { id: `2339 ${pad} 005`, iban: `US12BOFA00010003324${pad}`,    accountType: 'CA',     currency: 'USD',
        default: false, pending: false, closed: false, balance: 547_900.55,   openedAt: '2017-01-15', branch: '8897', label: 'USD — eksport' },
      { id: `2339 ${pad} 006`, iban: `PL61109010140000071219${pad}`, accountType: 'LOAN',   currency: 'PLN',
        default: false, pending: false, closed: false, balance: -2_500_000,   openedAt: '2022-09-01', branch: '8897', label: 'Kredyt obrotowy' },
      { id: `2339 ${pad} 007`, iban: `PL49124012221111000012${pad}`, accountType: 'DEP',    currency: 'PLN',
        default: false, pending: false, closed: false, balance: 5_000_000,    openedAt: '2024-12-30', branch: '8897', label: 'Lokata 12M' },
      { id: `2339 ${pad} 008`, iban: `PL83114020040000310267${pad}`, accountType: 'CA',     currency: 'PLN',
        default: false, pending: false, closed: true,  balance: 0,            openedAt: '2015-06-10', branch: '8897', label: 'Stare PLN (zamknięte)' },
    ];
  },

  /** Tworzy nowego usera klienta — przyjmuje rekord, zwraca persisted z nowym i2key. */
  'user-create': async (params: Record<string, unknown>): Promise<unknown> => {
    // eslint-disable-next-line no-console
    console.log('[mock user-create]', params);
    return { ...params, id2Key: `1${Date.now().toString().padStart(15, '0')}`.slice(0, 16) };
  },

  /** Aktualizuje parametry usera (oprócz identyfikatora). */
  'user-update': async (params: Record<string, unknown>): Promise<unknown> => {
    // eslint-disable-next-line no-console
    console.log('[mock user-update]', params);
    return params;
  },

  /** Usuwa usera klienta. */
  'user-delete': async (params: Record<string, unknown>): Promise<unknown> => {
    // eslint-disable-next-line no-console
    console.log('[mock user-delete]', params);
    return { deleted: true, id2Key: params['id2Key'] };
  },

  /** Tworzy nową transakcję FX — przyjmuje payload formularza, zwraca persisted z numerem. */
  'tx-create': async (params: Record<string, unknown>): Promise<unknown> => {
    // eslint-disable-next-line no-console
    console.log('[mock tx-create]', params);
    return { ...params, nrFx: `FX-${Date.now().toString().slice(-6)}`, status: 'Wykonana', dateTraded: new Date().toISOString().slice(0, 10) };
  },

  /** Save endpoint — przyjmuje `id` + zmodyfikowany rekord, zwraca persisted. */
  'client-update': async (params: Record<string, unknown>): Promise<unknown> => {
    // eslint-disable-next-line no-console
    console.log('[mock client-update] persisting:', params);
    // Mock: po prostu zwraca to co dostał (rich client mergedwith updates).
    // Produkcyjnie tu byłby PATCH/PUT do backendu.
    return params;
  },

  'client-by-id': async (params: Record<string, unknown>): Promise<unknown> => {
    const code = String(params['id'] ?? '');
    const res = await fetch('/assets/fixtures/clients.json');
    const all = (await res.json()) as Array<Record<string, unknown>>;
    const small = all.find((c) => c['code'] === code);
    if (small === undefined) { return null; }
    return enrich(small);
  },
};

function enrich(small: Record<string, unknown>): Record<string, unknown> {
  const code = String(small['code'] ?? '');
  const name = String(small['name'] ?? '');
  const status = small['status'] === 'Aktywny' ? 'ACTIVE' : 'DELETED';
  const isCorpo = (small['nip'] ?? '—') !== '—';
  const pesel = String(small['pesel'] ?? '');

  const dealer = { adname: 'id01', firstName: 'Michał', lastName: 'Łój' };
  const accountManager = 'OHZ';
  const branch = '8897';
  const csCode = 'WE';
  const customerType = isCorpo ? 'CORPO' : 'INDIVIDUAL';
  const customerRatingGroup =
    small['marginGroup'] === 'PRIORITY' ? 'GROUP_A' :
    small['marginGroup'] === 'PREMIUM'  ? 'GROUP_B' : 'GROUP_C';
  const customerRatingSegment = isCorpo ? 'COMMERCIAL' : 'RETAIL';
  const codeId = `${code}ADBXBYL4SAYMK808`.padEnd(20, 'X').slice(0, 20);
  const custom = `A${code}`;
  const availableTransactions = { TODAY: true, SPOT: true, FORWARD: true, SWAP: true, SFP: true, DCI: false };
  const customerCurrencyPairs = ['EUR/CHF', 'EUR/PLN', 'EUR/USD', 'GBP/PLN', 'GBP/USD', 'USD/CHF', 'USD/PLN'];

  return {
    access: true,
    accountManager,
    aidDataCollect: false,
    availableTransactions,
    branch,
    csCode,
    capDate: '2028-03-23',
    clientKind: isCorpo ? 0 : 1,
    codeId,
    commitmentLimitType: null,
    commitmentLimitValue: null,
    custom,
    customerAccounts: [
      { id: `2339 ${code} 001`, iban: `PL28160011720002339${code}001`, accountType: 'CA', currency: 'PLN' },
      { id: `2339 ${code} 002`, iban: `DE89370400440532013000${code}`, accountType: 'CA', currency: 'EUR' },
    ],
    customerCurrencyPairs,
    customerRatingGroup,
    customerRatingSegment,
    customerType,
    dealer,
    disableMargin: false,
    email: 'test@test.pl',
    entity: name,
    limitExpirationDate: '2028-05-08',
    limitReportFrequency: 'DAILY',
    marginGroup: 8,
    marginGroupForRetailPop: false,
    marginGroupVisible: true,
    marginSource: 'DEALER_GROUP',
    natio: 'Polska',
    preferredMarginIds: { FORWARD_FROM_1M: 'test-parforward2', FORWARD_TO_3M: 'test-parforward1' },
    regionPresId: '974495099',
    showMarginPoints: true,
    status,
    swapWithoutMargin: false,
    useAsAFMargin: false,
    useExperimentalMargin: false,
    uscrs: isCorpo ? [
      { id2Key: '1000000000000001', pesel: '74082800177', nameAndSurname: 'SZYMON OLEKSANDR POPŁAWSKI',
        dataUrodzenia: '1974-08-28', pelnomocnik: true,  dostep: true,  blokada: 'BRAK',
        fxPlanetVersion: 'NEW', notifTxExpiry: true,  notifDcd: true },
      { id2Key: '1000000000000002', pesel: '85051100123', nameAndSurname: 'ANNA MARIA KOWALSKA',
        dataUrodzenia: '1985-05-11', pelnomocnik: false, dostep: true,  blokada: 'BRAK',
        fxPlanetVersion: 'NEW', notifTxExpiry: false, notifDcd: true },
      { id2Key: '1000000000000003', pesel: '78031245678', nameAndSurname: 'PIOTR JAN NOWAK',
        dataUrodzenia: '1978-03-12', pelnomocnik: true,  dostep: false, blokada: 'CZASOWA — do 2026-06-30',
        fxPlanetVersion: 'OLD', notifTxExpiry: false, notifDcd: false },
    ] : [
      { id2Key: '1000000000000099', pesel, nameAndSurname: name.toUpperCase(),
        dataUrodzenia: '', pelnomocnik: false, dostep: true,  blokada: 'BRAK',
        fxPlanetVersion: 'NEW', notifTxExpiry: true,  notifDcd: false },
    ],
    // Pomocnicze (dla compatibility z list view jeśli ktoś bind'uje stare pola):
    code, name,

    // ─── Nowe pola dla pełnej edycji w Profilu ───────────────
    region: 'PL-CENTRAL',
    tenorRfed: '6M',
    margin1wD: 0.25,
    marginRollback: 5,
    maxMarginEcommerce: 50,
    specjalista: 'spec.kowalski',
    systemAccess: true,
    blockGlobalMargin: false,
    mol: false,
    fxSecured: true,
    marginAum: false,
    aiDataShare: true,
    txExpiryNotifications: true,
    swapPoints: false,
    groupRfq: true,
    txTODAY: availableTransactions.TODAY,
    txSPOT: availableTransactions.SPOT,
    txFORWARD: availableTransactions.FORWARD,
    txSWAP: availableTransactions.SWAP,
    txSFP: availableTransactions.SFP,
    txDCD: availableTransactions.DCI,
    dcdMargins: [
      { currency: 'PLN', bpsStandard: 15, bps: 25 },
      { currency: 'USD', bpsStandard: 20, bps: 30 },
      { currency: 'EUR', bpsStandard: 18, bps: 28 },
      { currency: 'CHF', bpsStandard: 22, bps: 32 },
      { currency: 'GBP', bpsStandard: 20, bps: 30 },
    ],
    currencyConversionLimits: [
      { pair: 'EUR/PLN', limitType: 'INDIVIDUAL', minAmount:    5_000, maxAmount: 1_000_000, dailyLimit: 2_000_000, monthlyLimit: 30_000_000 },
      { pair: 'USD/PLN', limitType: 'INDIVIDUAL', minAmount:    5_000, maxAmount:   800_000, dailyLimit: 1_500_000, monthlyLimit: 25_000_000 },
      { pair: 'GBP/PLN', limitType: 'GLOBAL',     minAmount:   10_000, maxAmount:   500_000, dailyLimit: 1_000_000, monthlyLimit: 15_000_000 },
      { pair: 'CHF/PLN', limitType: 'GLOBAL',     minAmount:   10_000, maxAmount:   500_000, dailyLimit: 1_000_000, monthlyLimit: 15_000_000 },
      { pair: 'EUR/USD', limitType: 'INDIVIDUAL', minAmount:    1_000, maxAmount:   200_000, dailyLimit:   500_000, monthlyLimit: 10_000_000 },
      { pair: 'GBP/USD', limitType: 'GLOBAL',     minAmount:    1_000, maxAmount:   200_000, dailyLimit:   500_000, monthlyLimit:  8_000_000 },
      { pair: 'USD/CHF', limitType: 'GLOBAL',     minAmount:    1_000, maxAmount:   150_000, dailyLimit:   400_000, monthlyLimit:  6_000_000 },
    ],

    // Tab Info renderuje rows model-driven (pure-fn `clientInfoRows` / `clientLimitsRows`
    // używa metadat z `ClientModel.@Field`). Endpoint nie musi pre-computować.
    __txTags: Object.entries(availableTransactions)
      .map(([label, enabled]) => ({ label, variant: enabled ? 'enabled' : 'extended' })),
    __pairsTags: customerCurrencyPairs.map((label) => ({ label, variant: 'enabled' })),
    __marginRows: [
      { k: 'Margin group',         v: '8' },
      { k: 'Margin source',        v: 'DEALER_GROUP' },
      { k: 'Visible',              v: 'tak' },
      { k: 'Disable margin',       v: 'nie' },
      { k: 'Show margin points',   v: 'tak' },
      { k: 'Use experimental',     v: 'nie' },
      { k: 'Swap without margin',  v: 'nie' },
    ],
  };
}
