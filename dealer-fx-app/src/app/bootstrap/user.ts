/**
 * Konfiguracja menu kontekstowego usera (rozwijane z koperty na dole sidebara).
 * Items z `route` automatycznie navigują; pozostałe emit'ują `userAction`
 * z AppShell — apka łapie w main.ts (np. logout handler).
 */
import { defineUserMenu } from '@echelon-framework/page-builders';

export const userMenu = defineUserMenu({
  name: 'jkolecki',
  subtitle: 'Dealer FX',
  icon: '●',
  items: [
    { id: 'profile',  label: 'Mój profil',     icon: '👤', route: '/profile' },
    { id: 'settings', label: 'Ustawienia',     icon: '⚙', route: '/settings' },
    { id: 'logout',   label: 'Wyloguj',        icon: '⏻', kind: 'danger', separatorBefore: true },
  ],
});
