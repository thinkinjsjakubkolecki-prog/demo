/**
 * fx-menu-editor — kreator menu aplikacji.
 *
 * Czyta bieżącą strukturę z `bootstrap/menu.ts`, pozwala edytować w UI
 * (add/remove/reorder/edit), a na koniec generuje gotowy TS source do
 * wklejenia z powrotem w `menu.ts`.
 *
 * Linkowanie do stron: dropdown route używa `getRegisteredPageClasses()` —
 * zawsze aktualna lista dostępnych `@Page` decorated klas.
 */
import { computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { inject } from '@angular/core';
import { EchelonWidget } from '@echelon-framework/runtime';
import { getRegisteredPageClasses } from '@echelon-framework/page-builders';
import type { MenuItem } from '@echelon-framework/page-builders';
import type { PageConfig } from '@echelon-framework/core';
import { menu as initialMenu } from '../bootstrap/menu';
import { DraftPageStoreService } from '../services/draft-page-store.service';

interface DraftMenuItem {
  id: string;
  label: string;
  icon?: string;
  route?: string;
  defaultOpen?: boolean;
  children: DraftMenuItem[];
  kind?: 'link' | 'user' | 'separator';
}

@EchelonWidget({
  manifest: {
    type: 'menu-editor',
    version: '0.1.0',
    category: 'designer',
    description: 'Menu editor — drzewo menu + link do zarejestrowanych stron + eksport.',
    inputs: [],
    outputs: [],
    actions: [],
    capabilities: { dataBus: 'read' },
    testability: { interactions: [], observables: ['menu-editor'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-menu-editor',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="wrap" data-testid="menu-editor" data-echelon-state="ready">
      <div class="bar">
        <h2>🧭 Menu Editor</h2>
        <div class="bar-actions">
          <button type="button" (click)="addTopLevel()">➕ Pozycja</button>
          <button type="button" (click)="addSeparator()">➖ Separator</button>
          <button type="button" (click)="reset()" title="Załaduj oryginalny menu.ts">↻ Reset</button>
          <button type="button" class="primary" (click)="openExport()">💾 Eksportuj</button>
        </div>
      </div>
      <div class="content">
        <div class="tree">
          <div class="tree-header">Struktura menu</div>
          <ng-container *ngTemplateOutlet="treeTpl; context: { items: items(), parent: null, depth: 0 }"></ng-container>
        </div>
        <div class="side">
          @if (selected(); as sel) {
            <div class="side-header">Szczegóły: {{ sel.id }}</div>
            <label class="form-label"><span>ID</span><input type="text" [value]="sel.id" (change)="update('id', $event)"/></label>
            <label class="form-label"><span>Label</span><input type="text" [value]="sel.label" (change)="update('label', $event)"/></label>
            <label class="form-label"><span>Icon (emoji)</span><input type="text" [value]="sel.icon ?? ''" (change)="update('icon', $event)" placeholder="np. 📊"/></label>
            <label class="form-label">
              <span>Route (leaf)</span>
              <select [value]="sel.route ?? ''" (change)="update('route', $event)">
                <option value="">— brak (węzeł grupujący) —</option>
                @for (r of availableRoutes(); track r.route) {
                  <option [value]="r.route">{{ r.title }} — {{ r.route }}</option>
                }
              </select>
            </label>
            <label class="fb-check">
              <input type="checkbox" [checked]="!!sel.defaultOpen" (change)="update('defaultOpen', $event)"/>
              defaultOpen (grupa otwarta po załadowaniu)
            </label>
            <div class="side-actions">
              @if (!sel.route || sel.children.length > 0) {
                <button type="button" (click)="addChild(sel)">➕ Dziecko</button>
              }
              <button type="button" class="danger" (click)="remove(sel)">🗑 Usuń</button>
            </div>
          } @else {
            <div class="empty">Wybierz pozycję w drzewie żeby edytować</div>
          }
        </div>
      </div>

      @if (exportOpen()) {
        <div class="modal-backdrop" (click)="closeExport()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <span>💾 Wygenerowany bootstrap/menu.ts</span>
              <button type="button" class="btn-close" (click)="closeExport()">✕</button>
            </div>
            <div class="modal-body">
              <pre class="modal-pre"><code>{{ generatedSource() }}</code></pre>
              <div class="save-actions">
                <button type="button" class="primary" (click)="copySource()">📋 Kopiuj</button>
                @if (copied()) { <span class="copied">✓ Skopiowano — wklej do src/app/bootstrap/menu.ts</span> }
              </div>
            </div>
          </div>
        </div>
      }
    </div>

    <ng-template #treeTpl let-items="items" let-parent="parent" let-depth="depth">
      @for (item of items; track item.id; let idx = $index) {
        <div class="node" [style.padding-left.px]="depth * 16">
          <div class="row" [class.active]="selectedId() === item.id"
               [class.group]="!item.route && (item.children?.length || !item.kind)"
               (click)="select(item)">
            <span class="caret">
              @if (item.children?.length) { {{ isOpen(item.id) ? '▾' : '▸' }} }
            </span>
            <span class="ic">{{ item.icon || (item.kind === 'separator' ? '—' : item.route ? '·' : '☰') }}</span>
            <span class="lbl">{{ item.label || '(bez nazwy)' }}</span>
            @if (item.route) { <span class="route">{{ item.route }}</span> }
            <span class="ctrls">
              <button type="button" class="btn-tiny" (click)="move(parent, idx, -1); $event.stopPropagation()" [disabled]="idx === 0">↑</button>
              <button type="button" class="btn-tiny" (click)="move(parent, idx, 1); $event.stopPropagation()" [disabled]="idx === (items?.length - 1)">↓</button>
            </span>
          </div>
          @if (item.children?.length && isOpen(item.id)) {
            <ng-container *ngTemplateOutlet="treeTpl; context: { items: item.children, parent: item, depth: depth + 1 }"></ng-container>
          }
        </div>
      }
    </ng-template>
  `,
  styles: [`
    :host { display: block; padding: 16px; color: var(--fg, #e5e7eb); }
    .wrap { background: var(--panel, #0f172a); border-radius: 6px; border: 1px solid var(--border, #1f2937); }
    .bar { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border, #1f2937); }
    .bar h2 { margin: 0; font-size: 15px; font-weight: 600; color: var(--accent, #58a6ff); }
    .bar-actions { display: flex; gap: 6px; }
    button { padding: 6px 12px; background: var(--panel-alt, #1f2937); border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    button:hover:not(:disabled) { border-color: #58a6ff; }
    button:disabled { opacity: 0.3; cursor: not-allowed; }
    button.primary { background: #1e3a5f; border-color: #3b82f6; color: #e0f2fe; }
    button.danger { background: #7f1d1d33; border-color: #ef4444; color: #fee2e2; }

    .content { display: grid; grid-template-columns: 1fr 340px; gap: 12px; padding: 12px; min-height: 500px; }
    .tree, .side { background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 4px; padding: 8px; overflow-y: auto; }
    .tree-header, .side-header { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #9ca3af); padding: 0 4px 8px; font-weight: 600; }

    .node { margin-bottom: 2px; }
    .row { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border: 1px solid transparent; border-radius: 3px; font-size: 12px; cursor: pointer; }
    .row:hover { background: #1a2332; border-color: var(--border, #374151); }
    .row.active { background: #1e3a5f33; border-color: #58a6ff; }
    .row.group { font-weight: 600; }
    .caret { width: 10px; font-size: 10px; color: var(--muted, #6b7280); text-align: center; }
    .ic { width: 18px; text-align: center; font-size: 13px; }
    .lbl { flex: 1; }
    .route { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; color: #10b981; background: #064e3b33; padding: 1px 6px; border-radius: 2px; }
    .ctrls { display: flex; gap: 2px; }
    .btn-tiny { padding: 0 5px; font-size: 9px; background: transparent; border: 1px solid transparent; color: var(--muted, #9ca3af); border-radius: 2px; min-width: 16px; }
    .btn-tiny:hover:not(:disabled) { background: #1f2937; border-color: var(--border, #374151); color: var(--fg, #e5e7eb); }

    .side { display: flex; flex-direction: column; gap: 8px; }
    .empty { padding: 40px 12px; color: var(--muted, #6b7280); text-align: center; font-style: italic; font-size: 12px; }
    .form-label { display: flex; flex-direction: column; gap: 3px; font-size: 10px; color: var(--muted, #9ca3af); }
    .form-label span { text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .form-label input, .form-label select { padding: 5px 8px; background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 2px; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .fb-check { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--fg, #e5e7eb); cursor: pointer; }
    .side-actions { display: flex; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border, #1f2937); }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal { background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); border-radius: 6px; width: 100%; max-width: 900px; max-height: 90vh; display: flex; flex-direction: column; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--border, #1f2937); font-weight: 600; color: var(--accent, #58a6ff); }
    .btn-close { background: transparent; border: none; color: var(--muted, #9ca3af); font-size: 16px; cursor: pointer; }
    .modal-body { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
    .modal-pre { margin: 0; padding: 12px; background: #0b1120; border: 1px solid var(--border, #1f2937); border-radius: 4px; font-size: 11px; line-height: 1.5; color: #d1d5db; max-height: 400px; overflow: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .save-actions { display: flex; gap: 8px; align-items: center; }
    .copied { color: #10b981; font-size: 12px; font-weight: 600; }
  `],
})
export class MenuEditorComponent {
  readonly items = signal<DraftMenuItem[]>(cloneMenu(initialMenu as ReadonlyArray<MenuItem>));
  readonly selectedId = signal<string | null>(null);
  private readonly expanded = signal<Set<string>>(new Set());
  readonly exportOpen = signal(false);
  readonly copied = signal(false);

  readonly selected = computed<DraftMenuItem | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    return findById(this.items(), id);
  });

  private readonly draftStore = inject(DraftPageStoreService);

  readonly availableRoutes = computed<ReadonlyArray<{ route: string; title: string }>>(() => {
    const classes = getRegisteredPageClasses() as Array<{ name?: string; config?: PageConfig; __echelonPageMeta?: { route?: string } }>;
    const out: Array<{ route: string; title: string }> = [];
    for (const cls of classes) {
      const route = cls.__echelonPageMeta?.route;
      const title = cls.config?.page.title ?? cls.name ?? '?';
      if (route) out.push({ route, title });
    }
    for (const d of this.draftStore.all()) {
      out.push({ route: `/draft/${d.id}`, title: `⚡ ${d.title}` });
    }
    out.sort((a, b) => a.route.localeCompare(b.route));
    return out;
  });

  readonly generatedSource = computed<string>(() => generateMenuSource(this.items()));

  constructor() {
    // Domyślnie otwórz te grupy które były defaultOpen w initialMenu
    const open = new Set<string>();
    walkItems(this.items(), (item) => {
      if (item.defaultOpen && item.children.length > 0) open.add(item.id);
    });
    this.expanded.set(open);
  }

  isOpen(id: string): boolean {
    return this.expanded().has(id);
  }

  select(item: DraftMenuItem): void {
    this.selectedId.set(item.id);
    if (item.children.length > 0) {
      const next = new Set(this.expanded());
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      this.expanded.set(next);
    }
  }

  update(field: keyof DraftMenuItem, event: Event): void {
    const t = event.target as HTMLInputElement;
    const raw: unknown = t.type === 'checkbox' ? t.checked : (t.value || undefined);
    const sel = this.selected();
    if (!sel) return;
    this.items.update((list) => updateInTree(list, sel.id, { [field]: raw }));
    // Jeśli user zmienił ID, zaktualizuj selection
    if (field === 'id' && typeof raw === 'string') this.selectedId.set(raw);
  }

  addTopLevel(): void {
    const id = this.generateId('item');
    this.items.update((list) => [...list, { id, label: 'Nowa pozycja', children: [] }]);
    this.selectedId.set(id);
  }

  addSeparator(): void {
    const id = this.generateId('sep');
    this.items.update((list) => [...list, { id, label: '', kind: 'separator', children: [] }]);
  }

  addChild(parent: DraftMenuItem): void {
    const id = this.generateId('child');
    this.items.update((list) => updateInTree(list, parent.id, (item) => ({
      ...item,
      children: [...item.children, { id, label: 'Nowa pozycja', children: [] }],
    })));
    // Rozwiń rodzica
    const next = new Set(this.expanded());
    next.add(parent.id);
    this.expanded.set(next);
    this.selectedId.set(id);
  }

  remove(item: DraftMenuItem): void {
    if (typeof window !== 'undefined' && !window.confirm(`Usunąć "${item.label || item.id}"?`)) return;
    this.items.update((list) => removeFromTree(list, item.id));
    if (this.selectedId() === item.id) this.selectedId.set(null);
  }

  move(parent: DraftMenuItem | null, idx: number, delta: number): void {
    this.items.update((list) => moveInTree(list, parent?.id ?? null, idx, delta));
  }

  reset(): void {
    if (typeof window !== 'undefined' && !window.confirm('Resetować menu do oryginalnego stanu?')) return;
    this.items.set(cloneMenu(initialMenu as ReadonlyArray<MenuItem>));
    this.selectedId.set(null);
  }

  openExport(): void {
    this.exportOpen.set(true);
    this.copied.set(false);
  }

  closeExport(): void {
    this.exportOpen.set(false);
  }

  copySource(): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(this.generatedSource()).then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      });
    }
  }

  private generateId(prefix: string): string {
    let n = 1;
    while (true) {
      const candidate = `${prefix}-${n}`;
      if (!findById(this.items(), candidate)) return candidate;
      n += 1;
    }
  }
}

function cloneMenu(items: ReadonlyArray<MenuItem>): DraftMenuItem[] {
  return items.filter((i) => i.kind !== 'user').map((i) => ({
    id: i.id,
    label: i.label,
    ...(i.icon !== undefined ? { icon: i.icon } : {}),
    ...(i.route !== undefined ? { route: i.route } : {}),
    ...(i.defaultOpen !== undefined ? { defaultOpen: i.defaultOpen } : {}),
    ...(i.kind !== undefined ? { kind: i.kind } : {}),
    children: cloneMenu(i.children ?? []),
  }));
}

function findById(items: DraftMenuItem[], id: string): DraftMenuItem | null {
  for (const i of items) {
    if (i.id === id) return i;
    const inChildren = findById(i.children, id);
    if (inChildren) return inChildren;
  }
  return null;
}

function updateInTree(items: DraftMenuItem[], id: string, patch: Partial<DraftMenuItem> | ((item: DraftMenuItem) => DraftMenuItem)): DraftMenuItem[] {
  return items.map((item) => {
    if (item.id === id) {
      return typeof patch === 'function' ? patch(item) : { ...item, ...patch };
    }
    if (item.children.length > 0) {
      return { ...item, children: updateInTree(item.children, id, patch) };
    }
    return item;
  });
}

function removeFromTree(items: DraftMenuItem[], id: string): DraftMenuItem[] {
  return items.filter((i) => i.id !== id).map((i) => ({
    ...i,
    children: removeFromTree(i.children, id),
  }));
}

function moveInTree(items: DraftMenuItem[], parentId: string | null, idx: number, delta: number): DraftMenuItem[] {
  if (parentId === null) {
    const out = [...items];
    const target = idx + delta;
    if (target < 0 || target >= out.length) return items;
    [out[idx], out[target]] = [out[target]!, out[idx]!];
    return out;
  }
  return items.map((item) => {
    if (item.id === parentId) {
      const out = [...item.children];
      const target = idx + delta;
      if (target < 0 || target >= out.length) return item;
      [out[idx], out[target]] = [out[target]!, out[idx]!];
      return { ...item, children: out };
    }
    if (item.children.length > 0) {
      return { ...item, children: moveInTree(item.children, parentId, idx, delta) };
    }
    return item;
  });
}

function walkItems(items: DraftMenuItem[], fn: (item: DraftMenuItem) => void): void {
  for (const i of items) {
    fn(i);
    walkItems(i.children, fn);
  }
}

function generateMenuSource(items: DraftMenuItem[]): string {
  const lines: string[] = [];
  lines.push(`/**`);
  lines.push(` * Menu apki — wygenerowane przez Menu Editor.`);
  lines.push(` * Ręcznie dopisz \`user\` sekcję na końcu jeśli była.`);
  lines.push(` */`);
  lines.push(`import { defineMenu } from '@echelon-framework/page-builders';`);
  lines.push(``);
  lines.push(`export const menu = defineMenu([`);
  for (const item of items) {
    lines.push(itemSource(item, '  '));
  }
  lines.push(`]);`);
  return lines.join('\n');
}

function itemSource(item: DraftMenuItem, indent: string): string {
  const parts: string[] = [];
  parts.push(`id: ${JSON.stringify(item.id)}`);
  parts.push(`label: ${JSON.stringify(item.label)}`);
  if (item.icon) parts.push(`icon: ${JSON.stringify(item.icon)}`);
  if (item.route) parts.push(`route: ${JSON.stringify(item.route)}`);
  if (item.defaultOpen) parts.push(`defaultOpen: true`);
  if (item.kind) parts.push(`kind: ${JSON.stringify(item.kind)}`);
  if (item.children.length > 0) {
    const childLines = item.children.map((c) => itemSource(c, indent + '    '));
    parts.push(`children: [\n${childLines.join(',\n')}\n${indent}  ]`);
  }
  return `${indent}{ ${parts.join(', ')} }`;
}
