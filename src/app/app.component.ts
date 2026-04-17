/**
 * Root komponent — inline shell (sidebar + topbar + outlet) z menu z
 * `bootstrap/menu.ts`. Frameworkowy `<ech-app-shell>` istnieje
 * w widgets-core ale wymaga ng-packagr (TODO w follow-up) zanim będzie
 * można go używać przez `imports: [...]` w template.
 */
import { ChangeDetectionStrategy, Component, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EVENT_BUS } from '@echelon-framework/runtime';
import type { EventBus } from '@echelon-framework/core';
import { menu } from './bootstrap/menu';
import type { MenuItem } from '@echelon-framework/page-builders';
import { exportPositionsToCsv } from './bootstrap/framework-integrations';
import { DraftFormStoreService } from './services/draft-form-store.service';
import { DraftPageStoreService } from './services/draft-page-store.service';
import { seedDesigners } from './forms/seed-designers';

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
            <a class="row leaf" [routerLink]="n.route" routerLinkActive="active">
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
    aside { background: var(--panel-alt); border-right: 1px solid var(--border); padding: 16px 12px;
            display: flex; flex-direction: column; min-height: 100vh; }
    nav { flex: 1; }
    .brand { font-weight: 700; font-size: 16px; padding: 4px 8px 16px; color: var(--accent); letter-spacing: 1px; border-bottom: 1px solid var(--border); margin-bottom: 12px; }
    .env { display: block; font-size: 9px; font-weight: 500; letter-spacing: 1px; color: var(--muted); margin-top: 2px; }
    nav { display: flex; flex-direction: column; gap: 1px; }
    .node { display: flex; flex-direction: column; gap: 1px; }
    .row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; color: var(--fg); text-decoration: none; border-radius: 4px; font-size: 13px; cursor: pointer; background: transparent; border: none; text-align: left; width: 100%; }
    .row:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
    .row.active { background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--accent); }
    .row.disabled { cursor: default; opacity: 0.5; }
    .caret { display: inline-block; width: 12px; font-size: 9px; color: var(--muted); transition: transform 0.15s; }
    .caret.open { transform: rotate(90deg); }
    .caret-spacer { display: inline-block; width: 12px; }
    .ic { display: inline-block; width: 18px; text-align: center; opacity: 0.7; }
    .lbl { flex: 1; }

    .content { display: flex; flex-direction: column; min-height: 100vh; }
    .user { display: flex; align-items: center; gap: 8px; padding: 10px 12px; margin-top: 12px;
            border-top: 1px solid var(--border); font-size: 13px; color: var(--muted); }
    .user-icon { color: var(--buy); }
    .user-name { color: var(--fg); font-weight: 500; }
    main { padding: 20px 24px; overflow-y: auto; flex: 1; }
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly eventBus = inject(EVENT_BUS) as EventBus;
  private readonly formStore = inject(DraftFormStoreService);
  private readonly pageStore = inject(DraftPageStoreService);

  constructor() {
    seedDesigners(this.pageStore, this.formStore);
    // Side-effect handler dla CSV export requestowanego z positions.page.
    // Trzymamy poza handlerem configu — side-effecty z DOM/download trafiają
    // do code-behind, handler pozostaje deklaratywny.
    this.eventBus.on<ReadonlyArray<Record<string, unknown>>>('fx.positions.csv.download-requested')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => { exportPositionsToCsv(event.payload ?? []); });
  }

  toggle(id: string): void { if (this.expanded.has(id)) { this.expanded.delete(id); } else { this.expanded.add(id); } }
  isOpen(id: string): boolean { return this.expanded.has(id); }
}
