/**
 * Menu apki — ręcznie definiowana struktura nawigacji. Niezależna od
 * `@Page` rejestracji stron — apka decyduje co ma być widoczne w menu.
 */
import { defineMenu } from '@echelon-framework/page-builders';

export const menu = defineMenu([
  { id: 'q',     label: 'Panel kwotowań', icon: '☰', route: '/quote' },
  { id: 'crm',   label: 'Klienci',        icon: '☰', defaultOpen: true, children: [
      { id: 'clients-list', label: 'Lista klientów', icon: '·', route: '/clients' }
  ] },
  { id: 'trxs',  label: 'Transakcje',     icon: '▥', children: [
      { id: 'tx-historia', label: 'Historia', icon: '·', route: '/positions' },
  ] },
  { id: 'other-trxs',         label: 'Inne transakcje',     icon: '▥', children: [] },
  { id: 'alerts-indicators',  label: 'Alerty / Indykacje',  icon: '▥', children: [] },
  { id: 'management',         label: 'Zarządzanie',         icon: '▥', children: [] },
  { id: 'godealer-management', label: 'GOdealer - zarządzanie', icon: '▥', children: [] },
  { id: 'informations',       label: 'Informacje',          icon: '▥', children: [] },
  { id: 'reports',            label: 'Raporty',             icon: '▥', children: [] },
  { id: 'permissions',        label: 'Uprawnienia',         icon: '▥', children: [] },

  // User-koperta — pinowana do dołu przez `<ech-menu-tree>` (kind: 'user').
  {
    id: 'user', kind: 'user',
    label: 'jkolecki', subtitle: 'Dealer FX', icon: '●',
    userActions: [
      { id: 'profile',  label: 'Mój profil',  icon: '👤', route: '/profile' },
      { id: 'settings', label: 'Ustawienia',  icon: '⚙', route: '/settings' },
      { id: 'logout',   label: 'Wyloguj',     icon: '⏻', kind: 'danger', separatorBefore: true },
    ],
  },
]);
