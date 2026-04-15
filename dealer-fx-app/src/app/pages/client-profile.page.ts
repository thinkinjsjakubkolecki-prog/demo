/**
 * Profil klienta — tabbed detail page z rozszerzanym headerem.
 *
 * Header pokazuje zawsze: nazwa + custom + status badge + customer type tag.
 * Po kliknięciu "Więcej szczegółów" — 4 sekcje: Klasyfikacja, Opiekunowie,
 * Limity, Dostępne produkty. Tab Info nie istnieje (dane są w headerze).
 */
import { Page, defineTabbedDetailPage } from '@echelon-framework/page-builders';
import { sidebarFieldsFromModel } from '@echelon-framework/model';
import { ClientModel } from '../models/client.model';
import {
  tabProfileConfig, tabUsersConfig,
  tabTransactionsFxConfig, tabOffersFxConfig, tabAlertsConfig,
  tabDcdConfig, tabMarginExanteConfig,
} from './client-profile/tabs';

// Pełna lista pól dostępnych do edycji — labels/types/validators wszystko z `ClientModel.@Field`.
// Pola read-only (codeId/custom/code) widoczne ale nie edytowalne.
// Dodanie nowego pola do edycji = jedna zmiana w `ClientModel` (editable: true) + dopisanie key tutaj.
function group(label: string, keys: ReadonlyArray<keyof ClientModel & string>) {
  return sidebarFieldsFromModel(ClientModel, keys).map((f) => ({ ...f, group: label }));
}

const EDIT_FIELDS = [
  ...group('Identyfikatory',  ['code', 'codeId', 'custom']),
  ...group('Podstawowe',      ['entity', 'status', 'customerType']),
  ...group('Klasyfikacja',    ['region', 'tenorRfed', 'customerRatingGroup']),
  ...group('Marże',           ['marginGroup', 'margin1wD', 'marginRollback', 'maxMarginEcommerce']),
  ...group('Opiekunowie',     ['accountManager', 'specjalista', 'natio', 'email']),
  ...group('Limity i raporty',['capDate', 'limitExpirationDate', 'limitReportFrequency']),
  ...group('Dostęp i flagi',  ['systemAccess', 'blockGlobalMargin', 'mol', 'fxSecured',
                               'marginAum', 'useExperimentalMargin', 'aiDataShare',
                               'txExpiryNotifications', 'swapPoints', 'groupRfq', 'swapWithoutMargin']),
  ...group('Dostępne transakcje', ['txTODAY', 'txSPOT', 'txFORWARD', 'txSWAP', 'txSFP', 'txDCD']),
];

interface Client {
  readonly entity: string;
  readonly custom: string;
  readonly codeId: string;
  readonly status: string;
  readonly customerType: string;
  readonly customerRatingGroup: string;
  readonly customerRatingSegment: string;
  readonly marginGroup: number;
  readonly marginSource: string;
  readonly accountManager: string;
  readonly branch: string;
  readonly csCode: string;
  readonly natio: string;
  readonly email: string;
  readonly capDate: string;
  readonly limitExpirationDate: string;
  readonly limitReportFrequency: string;
}

@Page({
  route: '/clients/:entityId',
  title: 'Klient — Profil',
})
export class ClientProfilePage {
  static readonly config = defineTabbedDetailPage<Client>({
    id: 'client-profile-shell',
    title: 'Klient — Profil',
    route: '/clients/:entityId',
    resolver: { endpoint: 'client-by-id', paramKey: 'id' },
    routeParamKey: 'entityId',
    header: {
      nameField: 'entity',
      subtitleField: 'custom',
      statusField: 'status',
      statusBadges: { ACTIVE: 'ok', DELETED: 'err' },
      typeField: 'customerType',
      typeTagColors: { CORPO: '#58a6ff', INDIVIDUAL: '#8b949e', RETAIL: '#d29922' },
    },
    editable: {
      fields: EDIT_FIELDS as never,
      saveEndpoint: 'client-update',
      idParamKey: 'id',
      successMessage: 'Zapisano klienta',
      buttonLabel: 'Edytuj klienta',
      accordion: true,            // tylko jedna sekcja otwarta na raz
      collapsedByDefault: true,   // wszystkie domyślnie zwinięte oprócz pierwszej
    },
    headerDetails: {
      sections: [
        { id: 'classification', label: 'Klasyfikacja',
          fields: [
            { key: 'codeId',                label: 'Code ID',  format: 'mono' },
            { key: 'customerRatingSegment', label: 'Segment' },
            { key: 'customerRatingGroup',   label: 'Rating' },
            { key: 'marginGroup',           label: 'Margin grp', format: 'mono' },
            { key: 'marginSource',          label: 'Margin source' },
          ] },
        { id: 'managers', label: 'Opiekunowie',
          fields: [
            // Dealer wyświetlany jako stringified obiekt — TODO: dedykowane formatowanie
            { key: 'accountManager', label: 'Account mgr' },
            { key: 'branch',         label: 'Oddział',  format: 'mono' },
            { key: 'csCode',         label: 'CS Code',  format: 'mono' },
            { key: 'natio',          label: 'Kraj' },
            { key: 'email',          label: 'Email' },
          ] },
        { id: 'limits', label: 'Limity',
          fields: [
            { key: 'capDate',                label: 'Cap date',         format: 'date' },
            { key: 'limitExpirationDate',    label: 'Wygasa',           format: 'date' },
            { key: 'limitReportFrequency',   label: 'Raport limitów' },
          ] },
      ],
    },
    defaultTab: 'transakcje-fx',
    tabs: [
      { id: 'profile',        label: 'Profil',          config: tabProfileConfig },
      { id: 'users',          label: 'Użytkownicy',     config: tabUsersConfig },
      { id: 'transakcje-fx',  label: 'Transakcje FX',   config: tabTransactionsFxConfig },
      { id: 'oferty-fx',      label: 'Oferty FX',       config: tabOffersFxConfig },
      { id: 'alerty',         label: 'Alerty kursowe',  config: tabAlertsConfig },
      { id: 'dcd',            label: 'DCD',             config: tabDcdConfig },
      { id: 'marza-exante',   label: 'Marża EX-ANTE',   config: tabMarginExanteConfig },
    ],
  });
}
