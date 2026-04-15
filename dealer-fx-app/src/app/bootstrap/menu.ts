/**
 * Menu apki — deklaratywna struktura nawigacji.
 * Rendered przez `<ech-app-shell [menu]="menu">`.
 */
import {defineMenu} from '@echelon-framework/page-builders';

export const menu = defineMenu([
    {
        id: 'q', label: 'Panel kwotowań', icon: '☰', defaultOpen: false, route: "/q"
    }, {
        id: 'crm', label: 'Klienci', icon: '☰', defaultOpen: false, children: [
            {id: 'clients-list', label: 'Lista klientów', icon: '·', route: '/clients'}
        ]
    },
    {
        id: 'trxs', label: 'Transakcje', icon: '▥', children: [
            {id: 'tx-historia', label: 'Historia', icon: '·', route: '/positions'},
        ]
    },

    {
        id: 'other-trxs', label: 'Inne ransakcje', icon: '▥', children: []
    }, {
        id: 'alerts-indicators', label: 'Alerty / Indykacje', icon: '▥', children: []
    }, {
        id: 'management', label: 'Zarządzanie', icon: '▥', children: []
    }, {
        id: 'godealer-management', label: 'GOdealer - zarzadzanie', icon: '▥', children: []
    },

    {
        id: 'informations', label: 'Informacje', icon: '▥', children: []
    },
    {
        id: 'reports', label: 'Raporty', icon: '▥', children: []
    }, {
        id: 'permissions', label: 'Uprawnienia', icon: '▥', children: []
    },
]);
