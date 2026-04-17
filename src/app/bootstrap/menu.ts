/**
 * Menu — tylko designery z frameworka.
 * Biznesowe pozycje dodajesz po stworzeniu stron w designerze.
 */
import { defineMenu } from '@echelon-framework/page-builders';
import { designerMenuItems } from '@echelon-framework/designer-widgets';

export const menu = defineMenu([
  { id: 'dev', label: 'Dev', icon: '⚙', defaultOpen: true, children: [
    ...designerMenuItems(),
  ] },
  {
    id: 'user', kind: 'user',
    label: 'jkolecki', subtitle: 'Dealer FX', icon: '●',
    userActions: [
      { id: 'logout', label: 'Wyloguj', icon: '⏻', kind: 'danger' },
    ],
  },
]);
