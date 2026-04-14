import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface NavNode {
  id: string;
  label: string;
  icon?: string;
  route?: string;
  children?: NavNode[];
}

@Component({
  selector: 'fx-app',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <aside>
        <div class="brand">DEALER FX <span class="env">DEV — LOCALHOST</span></div>
        <nav>
          <ng-container *ngTemplateOutlet="treeTpl; context: { items: nav, depth: 0 }"></ng-container>
        </nav>
      </aside>
      <div class="content">
        <header class="topbar">
          <div class="spacer"></div>
          <div class="user">
            <span class="user-icon">●</span>
            <span class="user-name">jkolecki</span>
          </div>
        </header>
        <main><router-outlet /></main>
      </div>
    </div>

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
            <span class="row leaf disabled">
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
    aside { background: #0a0e13; border-right: 1px solid var(--border); padding: 16px 12px; }
    .brand { font-weight: 700; font-size: 16px; padding: 4px 8px 16px; color: var(--accent); letter-spacing: 1px; border-bottom: 1px solid var(--border); margin-bottom: 12px; }
    .env { display: block; font-size: 9px; font-weight: 500; letter-spacing: 1px; color: var(--muted); margin-top: 2px; }
    nav { display: flex; flex-direction: column; gap: 1px; }
    .node { display: flex; flex-direction: column; gap: 1px; }
    .row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; color: var(--fg); text-decoration: none; border-radius: 4px; font-size: 13px; cursor: pointer; background: transparent; border: none; text-align: left; width: 100%; }
    .row:hover { background: rgba(88,166,255,0.08); }
    .row.active { background: rgba(88,166,255,0.18); color: var(--accent); }
    .row.disabled { cursor: default; opacity: 0.5; }
    .caret { display: inline-block; width: 12px; font-size: 9px; color: var(--muted); transition: transform 0.15s; }
    .caret.open { transform: rotate(90deg); }
    .caret-spacer { display: inline-block; width: 12px; }
    .ic { display: inline-block; width: 18px; text-align: center; opacity: 0.7; }
    .lbl { flex: 1; }

    .content { display: flex; flex-direction: column; min-height: 100vh; }
    .topbar { display: flex; align-items: center; justify-content: space-between; padding: 10px 24px; border-bottom: 1px solid var(--border); background: #0a0e13; }
    .spacer { flex: 1; }
    .user { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
    .user-icon { color: var(--buy); }
    .user-name { color: var(--fg); font-weight: 500; }
    main { padding: 20px 24px; overflow-y: auto; flex: 1; }
  `],
})
export class AppComponent {
  readonly nav: ReadonlyArray<NavNode> = [
    { id: 'panel-testowy', label: 'Panel testowy', icon: '▦', children: [
      { id: 'overview',     label: 'Overview',  icon: '·', route: '/d/dashboard' },
      { id: 'positions',    label: 'Positions', icon: '·', route: '/d/positions' },
      { id: 'quote',        label: 'Quote',     icon: '·', route: '/d/quote' },
    ] },
    { id: 'crm', label: 'Klienci', icon: '☰', children: [
      { id: 'clients-list', label: 'Lista klientów', icon: '·', route: '/d/clients-admin' },
      { id: 'client-fx',    label: 'FX klienta',     icon: '·', route: '/d/client-fx' },
      { id: 'client-profile', label: 'Profil klienta', icon: '·', route: '/d/client-profile' },
    ] },
    { id: 'transakcje', label: 'Transakcje', icon: '▥', children: [
      { id: 'tx-fx',        label: 'Transakcje FX', icon: '·', route: '/d/client-fx' },
      { id: 'tx-historia',  label: 'Historia',      icon: '·', route: '/d/positions' },
    ] },
    { id: 'alerty',       label: 'Alerty',        icon: '!' },
    { id: 'zarzadzanie',  label: 'Zarządzanie',   icon: '⚙', children: [
      { id: 'role',         label: 'Role',          icon: '·' },
      { id: 'parametry',    label: 'Parametry',     icon: '·' },
    ] },
    { id: 'raporty',      label: 'Raporty',       icon: '📊' },
    { id: 'uzytkownicy',  label: 'Użytkownicy',   icon: '👥' },
  ];

  private readonly expanded = new Set<string>(['panel-testowy', 'crm']);
  toggle(id: string): void { if (this.expanded.has(id)) { this.expanded.delete(id); } else { this.expanded.add(id); } }
  isOpen(id: string): boolean { return this.expanded.has(id); }
}
