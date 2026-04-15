/**
 * `clients-admin` — strona listy klientów zbudowana przez `defineEntityListPage`.
 *
 * Cała mechanika (filtrowanie, paginacja, sidebar, navigate na profil) wynika
 * z deklaracji — żadne handlery / computed pipeline nie są już ręcznie pisane.
 */
import { defineEntityListPage } from '@echelon-framework/page-builders';

interface Client {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: 'Aktywny' | 'Usunięty';
  readonly marginGroup: 'STANDARD' | 'PREMIUM' | 'PRIORITY' | 'VIP';
  readonly nip: string;
  readonly pesel: string;
  readonly regon: string;
  readonly accountNumber: string;
  readonly transactions: string;
  readonly assignment: string;
  readonly ecommerce: string;
  readonly specialist: string;
}

const TAG_COLORS = { PRIORITY: '#d29922', PREMIUM: '#58a6ff', STANDARD: '#8b949e', VIP: '#da6bc1' } as const;
const STATUS_BADGES = { Aktywny: 'ok', Usunięty: 'err' } as const;

export const clientsAdminPage = defineEntityListPage<Client>({
  id: 'clients-admin',
  title: 'Klienci',
  dataSource: 'clientsList',
  idField: 'code',
  pageSize: 10,
  filterCols: 6,
  filters: [
    { id: 'code', label: 'Numer klienta', type: 'text', placeholder: 'np. 000123', span: 1 },
    { id: 'name', label: 'Nazwa', type: 'text', placeholder: 'np. ACME', span: 3 },
    { id: 'status', label: 'Status', type: 'select', span: 1,
      options: [{ value: 'Aktywny', label: 'Aktywny' }, { value: 'Usunięty', label: 'Usunięty' }] },
    { id: 'marginGroup', label: 'Grupa marżowa', type: 'select', span: 1,
      options: [
        { value: 'STANDARD', label: 'STANDARD' }, { value: 'PREMIUM',  label: 'PREMIUM'  },
        { value: 'PRIORITY', label: 'PRIORITY' }, { value: 'VIP',      label: 'VIP'      },
      ] },
    { id: 'nip', label: 'NIP', type: 'text', span: 1 },
    { id: 'pesel', label: 'PESEL', type: 'text', span: 1 },
    { id: 'regon', label: 'REGON', type: 'text', span: 1 },
    { id: 'accountNumber', label: 'Numer rachunku', type: 'text', placeholder: 'PL…', span: 3 },
    { id: 'assignment', label: 'Przypisanie (dealer)', type: 'text', span: 2 },
    { id: 'ecommerce', label: 'E-commerce', type: 'text', span: 2 },
    { id: 'specialist', label: 'Specjalista', type: 'text', span: 2 },
  ],
  columns: [
    { key: 'code', label: 'Numer klienta', format: 'mono' },
    { key: 'name', label: 'Nazwa' },
    { key: 'nip', label: 'NIP', format: 'mono' },
    { key: 'transactions', label: 'Dostępne transakcje' },
    { key: 'marginGroup', label: 'Grupa marżowa', format: 'tag', tagColors: TAG_COLORS },
    { key: 'status', label: 'Status', format: 'badge', badges: STATUS_BADGES },
  ],
  sidebar: {
    recordSource: '',
    titleField: 'name',
    subtitleField: 'code',
    width: 460,
    layout: 'default',
    fields: [
      { key: 'code', label: 'Numer klienta', format: 'mono' },
      { key: 'name', label: 'Nazwa', editable: true, editType: 'text' },
      { key: 'status', label: 'Status', format: 'badge', badges: STATUS_BADGES,
        editable: true, editType: 'select',
        editOptions: [{ value: 'Aktywny', label: 'Aktywny' }, { value: 'Usunięty', label: 'Usunięty' }] },
      { key: 'marginGroup', label: 'Grupa marżowa', format: 'tag', tagColors: TAG_COLORS,
        editable: true, editType: 'select',
        editOptions: [
          { value: 'STANDARD', label: 'STANDARD' }, { value: 'PREMIUM', label: 'PREMIUM' },
          { value: 'PRIORITY', label: 'PRIORITY' }, { value: 'VIP', label: 'VIP' },
        ] },
      { key: 'nip', label: 'NIP', format: 'mono' },
      { key: 'pesel', label: 'PESEL', format: 'mono' },
      { key: 'regon', label: 'REGON', format: 'mono' },
      { key: 'accountNumber', label: 'Numer rachunku', format: 'mono', editable: true, editType: 'text' },
      { key: 'transactions', label: 'Transakcje' },
      { key: 'assignment', label: 'Dealer', editable: true, editType: 'text' },
      { key: 'ecommerce', label: 'E-commerce', editable: true, editType: 'text' },
      { key: 'specialist', label: 'Specjalista', editable: true, editType: 'text' },
    ],
    actions: [
      { id: 'edit', label: 'Edytuj', kind: 'primary', setLayout: 'edit-form', inLayout: ['default'] },
      { id: 'open', label: 'Otwórz profil', kind: 'ghost', inLayout: ['default'] },
      { id: 'delete', label: 'Usuń', kind: 'danger', inLayout: ['default'],
        when: { path: 'status', eq: 'Aktywny' } },
      { id: 'save', label: 'Zapisz', kind: 'primary', inLayout: ['edit-form'],
        when: { path: 'name', exists: true },
        success: { message: 'Zapisano klienta', duration: 1500, returnTo: 'default' } },
      { id: 'cancel', label: 'Anuluj', kind: 'ghost', setLayout: 'default', inLayout: ['edit-form'] },
    ],
  },
  navigateOnAction: { open: '/d/client-profile/:entityId' },
});
