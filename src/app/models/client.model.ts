/**
 * `ClientModel` — domain model klienta z field-level metadanymi czytanymi
 * przez framework w runtime (page-builders, walidacja, mapowanie kolumn).
 *
 * Pełen zestaw pól edytowalnych w panelu Profil:
 *  - identyfikatory (read-only),
 *  - tekstowe (nazwa, region, rating, dealer, specjalista),
 *  - liczbowe (marże w bps/%),
 *  - select-y (status, typ, freq raportu, grupa marżowa),
 *  - boolean (dostęp do systemu, blokady marż, flagi systemowe),
 *  - boolean per-typ transakcji (TODAY/SPOT/FORWARD/SWAP/SFP/DCD).
 */
import {
  Model, Field, Id, Title, Subtitle,
  Required, Pattern, MaxLength, Min, Max, EnumValues, Hidden,
} from '@echelon-framework/model';

@Model({ name: 'Client', endpoint: 'client-by-id' })
export class ClientModel {
  // ─── Identyfikatory ────────────────────────────────────────────────
  @Field({ label: 'Numer klienta', format: 'mono', readonly: true }) @Id() @Required()
  code!: string;

  @Field({ label: 'Code ID', format: 'mono', readonly: true })
  codeId!: string;

  @Field({ label: 'Custom', format: 'mono', readonly: true }) @Subtitle()
  custom!: string;

  // ─── Podstawowe ────────────────────────────────────────────────────
  @Field({ label: 'Nazwa', editable: true }) @Title() @Required() @MaxLength(200)
  entity!: string;

  @Field({ label: 'Status', format: 'badge', editable: true,
           badges: { ACTIVE: 'ok', DELETED: 'err' } })
  @EnumValues(['ACTIVE', 'DELETED'])
  status!: string;

  @Field({ label: 'Typ klienta', format: 'tag', editable: true,
           tagColors: { CORPO: '#58a6ff', INDIVIDUAL: '#8b949e', RETAIL: '#d29922' } })
  @EnumValues(['CORPO', 'INDIVIDUAL', 'RETAIL'])
  customerType!: string;

  // ─── Klasyfikacja / rating ─────────────────────────────────────────
  @Field({ label: 'Region', editable: true })
  region!: string;

  @Field({ label: 'Tenor RFED', editable: true })
  tenorRfed!: string;

  @Field({ label: 'Rating', editable: true,
           badges: { GROUP_A: 'ok', GROUP_B: 'info', GROUP_C: 'muted' } })
  customerRatingGroup!: string;

  @Field({ label: 'Segment' })
  customerRatingSegment!: string;

  // ─── Marże ─────────────────────────────────────────────────────────
  @Field({ label: 'Grupa marżowa', format: 'number', editable: true, kind: 'number' })
  @Min(1) @Max(20)
  marginGroup!: number;

  @Field({ label: 'Margin source' })
  marginSource!: string;

  @Field({ label: 'Marża 1W+D (%)', format: 'number', editable: true, kind: 'number', decimals: 2 })
  margin1wD!: number;

  @Field({ label: 'Marża rollback (bps)', format: 'number', editable: true, kind: 'number' })
  marginRollback!: number;

  @Field({ label: 'Max marża e-commerce (bps)', format: 'number', editable: true, kind: 'number' })
  maxMarginEcommerce!: number;

  // ─── Opiekunowie / kontakt ─────────────────────────────────────────
  @Field({ label: 'Account manager', editable: true })
  accountManager!: string;

  @Field({ label: 'Specjalista', editable: true })
  specjalista!: string;

  @Field({ label: 'Branch', format: 'mono' })
  branch!: string;

  @Field({ label: 'CS Code', format: 'mono' })
  csCode!: string;

  @Field({ label: 'Narodowość', editable: true })
  natio!: string;

  @Field({ label: 'Email', editable: true })
  @Pattern(/^.+@.+\..+$/, 'Niepoprawny email')
  email?: string;

  // ─── Limity i raporty ──────────────────────────────────────────────
  @Field({ label: 'Cap date', format: 'date' })
  capDate!: string;

  @Field({ label: 'Limit expiration', format: 'date' })
  limitExpirationDate!: string;

  @Field({ label: 'Wysyłka raportu limitu', editable: true })
  @EnumValues(['DAILY', 'WEEKLY', 'MONTHLY'])
  limitReportFrequency!: string;

  // ─── Boolean — dostęp i flagi systemowe ────────────────────────────
  @Field({ label: 'Dostęp do systemu', editable: true, kind: 'boolean' })
  systemAccess!: boolean;

  @Field({ label: 'Zablokuj marżę globalną', editable: true, kind: 'boolean' })
  blockGlobalMargin!: boolean;

  @Field({ label: 'MOL', editable: true, kind: 'boolean' })
  mol!: boolean;

  @Field({ label: 'FX secured', editable: true, kind: 'boolean' })
  fxSecured!: boolean;

  @Field({ label: 'Marża AUM', editable: true, kind: 'boolean' })
  marginAum!: boolean;

  @Field({ label: 'Marża eksperymentalna', editable: true, kind: 'boolean' })
  useExperimentalMargin!: boolean;

  @Field({ label: 'Udostępnianie danych AI', editable: true, kind: 'boolean' })
  aiDataShare!: boolean;

  @Field({ label: 'Powiadomienia o końcu transakcji', editable: true, kind: 'boolean' })
  txExpiryNotifications!: boolean;

  @Field({ label: 'Punkty swap', editable: true, kind: 'boolean' })
  swapPoints!: boolean;

  @Field({ label: 'Grupowanie RFQ', editable: true, kind: 'boolean' })
  groupRfq!: boolean;

  @Field({ label: 'Brak marży spot na swap', editable: true, kind: 'boolean' })
  swapWithoutMargin!: boolean;

  // ─── Boolean — dostęp do typów transakcji (PROD ACCESS) ────────────
  @Field({ label: 'TODAY',   editable: true, kind: 'boolean' })  txTODAY!:    boolean;
  @Field({ label: 'SPOT',    editable: true, kind: 'boolean' })  txSPOT!:     boolean;
  @Field({ label: 'FORWARD', editable: true, kind: 'boolean' })  txFORWARD!:  boolean;
  @Field({ label: 'SWAP',    editable: true, kind: 'boolean' })  txSWAP!:     boolean;
  @Field({ label: 'SFP',     editable: true, kind: 'boolean' })  txSFP!:      boolean;
  @Field({ label: 'DCD',     editable: true, kind: 'boolean' })  txDCD!:      boolean;

  // ─── Hidden — dostępne w bind, nie pokazywane w edytorze ───────────
  @Field() @Hidden() customerCurrencyPairs!: ReadonlyArray<string>;
  @Field() @Hidden() customerAccounts!: ReadonlyArray<{ id: string; iban: string; accountType: string; currency: string }>;
  @Field() @Hidden() uscrs!: ReadonlyArray<{ id2Key: string; pesel: string; nameAndSurname: string }>;
  @Field() @Hidden() availableTransactions!: Record<string, boolean>;
  @Field() @Hidden() dealer!: { adname: string; firstName: string; lastName: string };
  @Field() @Hidden() dcdMargins!: ReadonlyArray<{ currency: string; bps: number }>;
}
