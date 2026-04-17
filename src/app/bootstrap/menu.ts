/**
 * Menu apki — ręcznie definiowana struktura nawigacji.
 * Designery importowane z frameworka — developer decyduje gdzie je pokazać.
 */
import { defineMenu } from '@echelon-framework/page-builders';
import { designerMenuItems } from '@echelon-framework/designer-widgets';

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
  { id: 'dev', label: 'Dev', icon: '⚙', defaultOpen: true, children: [
      ...designerMenuItems(),
      { id: 'business-flow', label: 'Business Flow (realne)', icon: '🎯', route: '/business-flow' },
      { id: 'process-flow',  label: 'Process Flow (technical)', icon: '🔀', route: '/process-flow' },
  ] },

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
