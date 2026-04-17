/**
 * Root komponent — inline shell (sidebar + topbar + outlet) z menu z
 * `bootstrap/menu.ts`. Frameworkowy `<ech-app-shell>` istnieje
 * w widgets-core ale wymaga ng-packagr (TODO w follow-up) zanim będzie
 * można go używać przez `imports: [...]` w template.
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { menu } from './bootstrap/menu';
import type { MenuItem } from '@echelon-framework/page-builders';
import { BUILT_IN_THEMES, applyTheme } from './framework/css-themes';

@Component({
  selector: 'fx-app',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (embedMode) {
      <!-- Embed mode — aplikacja w iframe, bez chrome-u (sidebar+menu).
           Detekcja: window.self !== window.top. -->
      <main class="embed"><router-outlet /></main>
    } @else {
      <div class="shell">
        <aside>
          <div class="brand">DEALER FX <span class="env" [attr.data-env]="envLabel">{{ envLabel }}</span></div>
          <nav>
            <ng-container *ngTemplateOutlet="treeTpl; context: { items: menu, depth: 0 }"></ng-container>
          </nav>
          <div class="user">
            <span class="user-icon">●</span>
            <span class="user-name">jkolecki</span>
          </div>
        </aside>
        <div class="content">
          <main><router-outlet /></main>
        </div>
      </div>
    }

    <ng-template #treeTpl let-items="items" let-depth="depth">
      @for (n of items; track n.id) {
        <div class="node" [style.padding-left.px]="depth * 12">
          @if (n.children && n.children.length > 0) {
            <button type="button" class="row branch" (click)="toggle(n.id)">
              <span class="caret" [class.open]="isOpen(n.id)">▸</span>
              @if (n.icon) { <span class="ic">{{ n.icon }}</span> }
              <span class="lbl">{{ n.label }}</span>
            </button>
            @if (isOpen(n.id)) {
              <ng-container *ngTemplateOutlet="treeTpl; context: { items: n.children, depth: depth + 1 }"></ng-container>
            }
          } @else if (n.route) {
            <a class="row leaf" [routerLink]="n.route" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
              <span class="caret-spacer"></span>
              @if (n.icon) { <span class="ic">{{ n.icon }}</span> }
              <span class="lbl">{{ n.label }}</span>
            </a>
          } @else {
            <span class="row disabled">
              <span class="caret-spacer"></span>
              @if (n.icon) { <span class="ic">{{ n.icon }}</span> }
              <span class="lbl">{{ n.label }}</span>
            </span>
          }
        </div>
      }
    </ng-template>
  `,
  styles: [`
    .shell { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
    aside { background: var(--ech-panel-alt, var(--ech-panel)); border-right: 1px solid var(--ech-border); padding: var(--ech-spacing) calc(var(--ech-spacing-sm) + 4px);
            display: flex; flex-direction: column; min-height: 100vh; }
    nav { flex: 1; display: flex; flex-direction: column; gap: 1px; }
    .brand { font-weight: 700; font-size: 16px; padding: var(--ech-spacing-xs) var(--ech-spacing-sm) var(--ech-spacing); color: var(--ech-accent); letter-spacing: 1px; border-bottom: 1px solid var(--ech-border); margin-bottom: calc(var(--ech-spacing-sm) + 4px); }
    .env { display: block; font-size: 9px; font-weight: 500; letter-spacing: 1px; color: var(--ech-muted); margin-top: 2px; }
    .node { display: flex; flex-direction: column; gap: 1px; }
    .row { display: flex; align-items: center; gap: var(--ech-spacing-sm); padding: var(--ech-spacing-sm) calc(var(--ech-spacing-sm) + 4px); color: var(--ech-fg); text-decoration: none; border-radius: var(--ech-radius-sm); font-size: var(--ech-font-size); cursor: pointer; background: transparent; border: none; text-align: left; width: 100%; transition: background var(--ech-transition); }
    .row:hover { background: color-mix(in srgb, var(--ech-accent) 10%, transparent); }
    .row.active { background: color-mix(in srgb, var(--ech-accent) 22%, transparent); color: var(--ech-accent); }
    .row.disabled { cursor: default; opacity: 0.5; }
    .caret { display: inline-block; width: 12px; font-size: 9px; color: var(--ech-muted); transition: transform var(--ech-transition); }
    .caret.open { transform: rotate(90deg); }
    .caret-spacer { display: inline-block; width: 12px; }
    .ic { display: inline-block; width: 18px; text-align: center; opacity: 0.7; }
    .lbl { flex: 1; }

    .content { display: flex; flex-direction: column; min-height: 100vh; }
    .user { display: flex; align-items: center; gap: var(--ech-spacing-sm); padding: 10px calc(var(--ech-spacing-sm) + 4px); margin-top: calc(var(--ech-spacing-sm) + 4px);
            border-top: 1px solid var(--ech-border); font-size: var(--ech-font-size); color: var(--ech-muted); }
    .user-icon { color: var(--ech-success); }
    .user-name { color: var(--ech-fg); font-weight: 500; }
    main { padding: var(--ech-spacing) calc(var(--ech-spacing) + 8px); overflow-y: auto; flex: 1; }
    main.embed { min-height: 100vh; padding: 0; overflow: auto; }
  `],
})
export class AppComponent {
  readonly envLabel: string = (document.documentElement.dataset['env'] ?? 'dev').toUpperCase();
  readonly menu: ReadonlyArray<MenuItem> = menu;

  /**
   * Embed mode — true gdy aplikacja renderuje się w iframe.
   *
   * Najbezpieczniejsza metoda detekcji: `window.self !== window.top`.
   * Przeglądarka sama wie czy jest w iframe, niezależnie od URL, query params,
   * Router event timing itd. Synchroniczny check w konstruktorze → gotowa
   * wartość przed pierwszym render-em template-a. Zero signal tracking, zero
   * race conditions.
   *
   * Safe try/catch dla cross-origin iframe (np. gdy parent to inny origin —
   * SecurityError — wtedy też jesteśmy w iframe, więc fallback na true).
   */
  readonly embedMode: boolean = (() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true; // cross-origin parent access throws → znaczy że JESTEŚMY w iframe
    }
  })();

  private readonly expanded = new Set<string>(menu.filter((i) => i.defaultOpen).map((i) => i.id));

  constructor() {
    const savedTheme = typeof window !== 'undefined' ? window.localStorage?.getItem('dealer-fx:theme') : null;
    const theme = BUILT_IN_THEMES.find((t) => t.id === savedTheme) ?? BUILT_IN_THEMES[0];
    applyTheme(theme);
  }

  toggle(id: string): void { if (this.expanded.has(id)) { this.expanded.delete(id); } else { this.expanded.add(id); } }
  isOpen(id: string): boolean { return this.expanded.has(id); }
}
