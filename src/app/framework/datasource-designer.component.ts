/**
 * fx-datasource-designer — dedykowana sekcja designera dla data sources.
 *
 * Agreguje datasources ze WSZYSTKICH stron (zarejestrowanych + drafty),
 * pozwala tworzyć, edytować, TESTOWAĆ (wywołać + pokazać response).
 *
 * Strukturalnie:
 *  - lista po lewej: wszystkie DS z source info (page / global)
 *  - środek: aktualny snapshot wartości (live z DataBus)
 *  - prawa strona: edit form (podobny do dsDialog z designer-shell)
 */
import {
  computed,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EchelonWidget, DATA_BUS } from '@echelon-framework/runtime';
import { getRegisteredPageClasses } from '@echelon-framework/page-builders';
import type { DataBus, PageConfig, DatasourceConfig } from '@echelon-framework/core';
import { DraftPageStoreService } from './designer-core';
import { DraftDatasourceStoreService, type DraftDatasource } from './designer-core';
import { DraftModelStoreService } from './designer-core';
import type { Schema } from './designer-core';

interface DsEntry {
  readonly id: string;
  readonly source: 'standalone' | 'page' | 'draft-page';
  readonly sourceLabel: string;
  readonly kind: string;
  readonly transport?: string;
  readonly endpoint?: string;
  readonly outputModelId?: string;
}

@EchelonWidget({
  manifest: {
    type: 'datasource-designer',
    version: '0.1.0',
    category: 'designer',
    description: 'Designer sekcja dla data sources — lista, test, snapshot.',
    inputs: [],
    outputs: [],
    actions: [],
    capabilities: { dataBus: 'read' },
    testability: { interactions: [], observables: ['datasource-designer'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-datasource-designer',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="wrap" data-testid="datasource-designer" data-echelon-state="ready">
      <div class="toolbar">
        <h2>📦 Data Sources</h2>
        <div class="meta">
          <span>{{ allDatasources().length }} łącznie</span>
          <span class="sep">·</span>
          <span>{{ byKind('transport') }} transport</span>
          <span class="sep">·</span>
          <span>{{ byKind('local') }} local/value</span>
          <span class="sep">·</span>
          <span>{{ byKind('computed') }} computed</span>
        </div>
        <input type="search" class="search" placeholder="Szukaj po id / page..."
               [ngModel]="filter()" (ngModelChange)="filter.set($event)" />
        <button type="button" class="btn-new" (click)="openCreateDialog()">+ Nowy datasource</button>
      </div>

      <div class="layout">
        <aside class="list">
          <div class="list-header">Źródła danych</div>
          @for (ds of filteredDatasources(); track ds.id + ds.source + ds.sourceLabel) {
            <button type="button" class="ds-item"
                    [class.active]="selected()?.id === ds.id"
                    [class.standalone]="ds.source === 'standalone'"
                    (click)="select(ds)">
              <div class="ds-line-1">
                <span class="ds-id">{{ ds.id }}</span>
                <span class="ds-kind">{{ ds.kind }}</span>
              </div>
              <div class="ds-line-2">
                @if (ds.source === 'standalone') { <span class="badge-sa">standalone</span> }
                @else { {{ ds.sourceLabel }} }
                @if (ds.outputModelId) { <span class="badge-model">🧩 {{ ds.outputModelId }}</span> }
              </div>
              @if (ds.endpoint) {
                <div class="ds-line-3"><code>{{ ds.endpoint }}</code></div>
              }
            </button>
          }
          @if (filteredDatasources().length === 0) {
            <div class="empty">
              @if (filter()) {
                Brak wyników dla "{{ filter() }}"
              } @else {
                Brak datasources — stwórz w page designer-ze (strona → Data Sources → + ds)
              }
            </div>
          }
        </aside>

        <main class="detail">
          @if (selected(); as sel) {
            <div class="detail-header">
              <div>
                <div class="detail-title">{{ sel.id }}</div>
                <div class="detail-sub">{{ sel.kind }}{{ sel.transport ? ' · ' + sel.transport : '' }} · {{ sel.sourceLabel }}</div>
              </div>
              <div class="detail-actions">
                <button type="button" (click)="testDatasource(sel)" class="btn-primary">▶ Test / Snapshot</button>
                @if (sel.source === 'standalone') {
                  <button type="button" (click)="deleteDatasource(sel)" class="btn-danger" title="Usuń">🗑 Usuń</button>
                }
              </div>
            </div>

            <div class="detail-grid">
              <div class="detail-block">
                <div class="block-header">Konfiguracja</div>
                <pre class="block-code">{{ formatDsEntry(sel) }}</pre>
              </div>

              <div class="detail-block">
                <div class="block-header">
                  Live snapshot
                  @if (testStatus() === 'loading') { <span class="status loading">ładowanie…</span> }
                  @if (testStatus() === 'ready') { <span class="status ready">✓ ready</span> }
                  @if (testStatus() === 'error') { <span class="status error">✗ error</span> }
                  @if (testStatus() === 'idle') { <span class="status idle">(klik 'Test')</span> }
                </div>
                <pre class="block-code">{{ snapshotJson() }}</pre>
              </div>

              <div class="detail-block">
                <div class="block-header">Użycie</div>
                <div class="usage-list">
                  @for (u of usages(); track u.pageTitle + u.widgetId + u.bindKey) {
                    <div class="usage-row">
                      <span class="usage-page">{{ u.pageTitle }}</span>

                      <span class="usage-arrow">→</span>
                      <span class="usage-widget">{{ u.widgetId }}</span>
                      <span class="usage-arrow">.</span>
                      <span class="usage-key">bind.{{ u.bindKey }}</span>
                    </div>
                  }
                  @if (usages().length === 0) {
                    <div class="empty-inline">Niewykorzystany — żaden widget nie bindi się do tego ds</div>
                  }
                </div>
              </div>

              <div class="detail-block schema-block">
                <div class="block-header">
                  📐 Output Schema (typ danych na wyjściu)
                </div>
                <div class="schema-source">
                  <label class="field">
                    <span class="field-label">Źródło schematu</span>
                    <select [ngModel]="selectedOutputModelId()" (ngModelChange)="setOutputModel(sel, $event)">
                      <option value="">— brak (ręczny) —</option>
                      @for (m of modelStore.all(); track m.id) {
                        <option [value]="m.id">🧩 {{ m.id }} — {{ m.title }} ({{ m.fields.length }} pól)</option>
                      }
                    </select>
                  </label>
                </div>
                @if (outputSchemaPreview(); as preview) {
                  <pre class="block-code schema-code">{{ preview }}</pre>
                } @else {
                  <div class="empty-inline">Wybierz model żeby DS deklarował kształt danych na wyjściu.</div>
                }
              </div>
            </div>
          } @else {
            <div class="detail-empty">
              <div class="empty-icon">📦</div>
              <div class="empty-title">Wybierz datasource z listy</div>
              <div class="empty-desc">Zobacz konfigurację, aktualną wartość i gdzie jest używany.</div>
            </div>
          }
        </main>
      </div>

      @if (createDialogOpen()) {
        <div class="modal-backdrop" (click)="closeCreateDialog()"></div>
        <div class="modal">
          <div class="modal-header">
            <h3>+ Nowy datasource</h3>
            <button type="button" class="btn-close" (click)="closeCreateDialog()">✕</button>
          </div>
          <div class="modal-body">
            <label class="field">
              <span class="field-label">ID</span>
              <input type="text" [ngModel]="newDsId()" (ngModelChange)="newDsId.set($event)" placeholder="np. clientsList" />
            </label>

            <label class="field">
              <span class="field-label">Nazwa</span>
              <input type="text" [ngModel]="newDsTitle()" (ngModelChange)="newDsTitle.set($event)" placeholder="np. Lista klientów" />
            </label>

            <label class="field">
              <span class="field-label">Rodzaj</span>
              <select [ngModel]="newDsKind()" (ngModelChange)="newDsKind.set($event)">
                <option value="transport">transport — http/websocket</option>
                <option value="stream">stream — websocket live</option>
                <option value="local">local — wartość statyczna</option>
                <option value="computed">computed — wyliczana z innych ds</option>
              </select>
            </label>

            @if (newDsKind() === 'transport' || newDsKind() === 'stream') {
              <label class="field">
                <span class="field-label">Transport</span>
                <select [ngModel]="newDsTransport()" (ngModelChange)="newDsTransport.set($event)">
                  <option value="http">http</option>
                  <option value="websocket">websocket</option>
                  <option value="mock">mock</option>
                </select>
              </label>
              <label class="field">
                <span class="field-label">Endpoint</span>
                <input type="text" [ngModel]="newDsEndpoint()" (ngModelChange)="newDsEndpoint.set($event)" placeholder="/api/clients" />
              </label>
            }

            <label class="field">
              <span class="field-label">Output Model (typ danych na wyjściu)</span>
              <select [ngModel]="newDsOutputModel()" (ngModelChange)="newDsOutputModel.set($event)">
                <option value="">— brak —</option>
                @for (m of modelStore.all(); track m.id) {
                  <option [value]="m.id">🧩 {{ m.id }} — {{ m.title }}</option>
                }
              </select>
            </label>

            @if (newDsKind() === 'local') {
              <label class="field">
                <span class="field-label">Initial value (JSON)</span>
                <textarea rows="3" [ngModel]="newDsInitial()" (ngModelChange)="newDsInitial.set($event)" placeholder='np. "hello" albo { "a": 1 }'></textarea>
              </label>
            }

            @if (newDsKind() === 'computed') {
              <label class="field">
                <span class="field-label">Funkcja</span>
                <input type="text" [ngModel]="newDsFn()" (ngModelChange)="newDsFn.set($event)" placeholder="np. sumPnl" />
              </label>
              <label class="field">
                <span class="field-label">Dependencies (CSV ds ids)</span>
                <input type="text" [ngModel]="newDsDeps()" (ngModelChange)="newDsDeps.set($event)" placeholder="positionsList,spotRate" />
              </label>
            }

            @if (createError()) { <div class="error-box">{{ createError() }}</div> }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-ghost" (click)="closeCreateDialog()">Anuluj</button>
            <button type="button" class="btn-primary" (click)="createDatasource()">Zapisz</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; padding: 16px; color: var(--ech-fg, #e5e7eb); height: 100%; }
    .wrap { display: flex; flex-direction: column; height: 100%; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #1f2937); border-radius: 6px; }

    .toolbar { display: flex; align-items: center; gap: 16px; padding: 12px 16px; border-bottom: 1px solid var(--ech-border, #1f2937); }
    .toolbar h2 { margin: 0; font-size: 15px; font-weight: 600; color: var(--ech-accent, #58a6ff); }
    .meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ech-muted, #9ca3af); }
    .sep { color: var(--ech-muted, #6b7280); }
    .search { flex: 1; max-width: 300px; padding: 6px 10px; background: var(--ech-panel-alt, #1f2937); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: 4px; font-size: 12px; margin-left: auto; }

    .layout { display: grid; grid-template-columns: 320px 1fr; flex: 1; min-height: 0; }
    .list { background: var(--ech-panel-alt, #111827); border-right: 1px solid var(--ech-border, #1f2937); overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 3px; }
    .list-header { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ech-muted, #9ca3af); padding: 4px 8px 8px; font-weight: 600; }
    .empty, .empty-inline { padding: 20px 10px; text-align: center; font-size: 12px; color: var(--ech-muted, #9ca3af); font-style: italic; }
    .empty-inline { padding: 8px; text-align: left; }

    .ds-item { background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); border-left: 3px solid var(--ech-border, #374151); border-radius: 3px; padding: 8px 10px; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 3px; color: var(--ech-fg, #e5e7eb); font-family: inherit; }
    .ds-item:hover { border-color: #58a6ff66; }
    .ds-item.active { background: #1e3a5f33; border-color: #58a6ff; border-left-color: #58a6ff; }
    .ds-item.standalone { border-left-color: #10b981; }
    .badge-sa { font-size: 8px; color: #6ee7b7; background: #064e3b; padding: 1px 5px; border-radius: 2px; text-transform: uppercase; font-weight: 600; }
    .badge-model { font-size: 8px; color: #c4b5fd; background: #5b21b622; padding: 1px 5px; border-radius: 2px; margin-left: 4px; }
    .ds-line-1 { display: flex; align-items: center; gap: 6px; }
    .ds-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; font-weight: 600; color: #93c5fd; flex: 1; }
    .ds-kind { font-size: 9px; color: var(--ech-muted, #9ca3af); background: #1f2937; padding: 1px 6px; border-radius: 2px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .ds-line-2 { font-size: 10px; color: var(--ech-muted, #6b7280); }
    .ds-line-3 { font-size: 10px; color: #6ee7b7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ds-line-3 code { background: transparent; color: inherit; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; }

    .detail { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
    .detail-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--ech-border, #1f2937); }
    .detail-title { font-size: 18px; font-weight: 700; color: var(--ech-fg, #e5e7eb); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .detail-sub { font-size: 12px; color: var(--ech-muted, #9ca3af); margin-top: 2px; }
    .detail-actions { display: flex; gap: 6px; }
    .btn-primary { padding: 6px 14px; background: #1e3a5f; border: 1px solid #3b82f6; color: #e0f2fe; border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-primary:hover { background: #1e40af; }

    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .detail-block { grid-column: 1 / -1; background: var(--ech-panel-alt, #111827); border: 1px solid var(--ech-border, #1f2937); border-radius: 4px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .detail-block:nth-child(1), .detail-block:nth-child(2) { grid-column: span 1; }
    .block-header { display: flex; align-items: center; gap: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ech-muted, #9ca3af); font-weight: 600; }
    .block-code { margin: 0; padding: 10px; background: #0b1120; border-radius: 3px; font-size: 11px; color: #d1d5db; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow-x: auto; max-height: 300px; white-space: pre-wrap; word-break: break-all; }

    .status { margin-left: auto; font-size: 10px; padding: 1px 6px; border-radius: 2px; }
    .status.loading { background: #713f1233; color: #fcd34d; }
    .status.ready { background: #064e3b33; color: #10b981; }
    .status.error { background: #7f1d1d33; color: #fee2e2; }
    .status.idle { background: #1f2937; color: var(--ech-muted, #6b7280); }

    .usage-list { display: flex; flex-direction: column; gap: 4px; }
    .usage-row { display: flex; align-items: center; gap: 4px; padding: 5px 8px; background: #0b1120; border-radius: 3px; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .usage-page { color: var(--ech-muted, #9ca3af); }
    .usage-arrow { color: var(--ech-muted, #6b7280); }
    .usage-widget { color: #93c5fd; }
    .usage-key { color: #6ee7b7; }

    .detail-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--ech-muted, #9ca3af); padding: 40px; text-align: center; }
    .empty-icon { font-size: 48px; opacity: 0.4; }
    .empty-title { font-size: 16px; font-weight: 600; color: var(--ech-fg, #e5e7eb); }
    .empty-desc { font-size: 13px; }

    .btn-new { padding: 6px 14px; background: #064e3b; border: 1px solid #10b981; color: #d1fae5; border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-new:hover:not(:disabled) { background: #065f46; }
    .btn-new:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-danger { padding: 6px 12px; background: #7f1d1d33; border: 1px solid #ef4444; color: #fecaca; border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-danger:hover { background: #7f1d1d66; }
    .btn-ghost { padding: 6px 14px; background: transparent; border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-ghost:hover { background: #1f2937; }
    .btn-close { background: transparent; border: none; color: var(--ech-muted, #9ca3af); font-size: 18px; cursor: pointer; padding: 4px 8px; }
    .btn-close:hover { color: var(--ech-fg, #e5e7eb); }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; }
    .modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 101; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); border-radius: 6px; width: 480px; max-width: calc(100vw - 40px); max-height: calc(100vh - 80px); display: flex; flex-direction: column; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--ech-border, #1f2937); }
    .modal-header h3 { margin: 0; font-size: 14px; color: var(--ech-fg, #e5e7eb); font-weight: 600; }
    .modal-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--ech-border, #1f2937); }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--ech-muted, #9ca3af); font-weight: 600; }
    .field input, .field select, .field textarea { padding: 6px 10px; background: var(--ech-panel-alt, #1f2937); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: 3px; font-size: 12px; font-family: inherit; }
    .field textarea { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; resize: vertical; }
    .error-box { padding: 8px 10px; background: #7f1d1d33; border: 1px solid #ef4444; color: #fecaca; border-radius: 3px; font-size: 11px; }

    .schema-block { border-color: #8b5cf633; }
    .schema-source { margin-bottom: 8px; }
    .schema-source select { width: 100%; padding: 6px 10px; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: 3px; font-size: 12px; font-family: inherit; }
    .schema-code { color: #c4b5fd; }
  `],
})
export class DatasourceDesignerComponent {
  readonly draftStore = inject(DraftPageStoreService);
  readonly dsStore = inject(DraftDatasourceStoreService);
  readonly modelStore = inject(DraftModelStoreService);
  private readonly dataBus = inject(DATA_BUS, { optional: true }) as DataBus | null;
  private readonly destroyRef = inject(DestroyRef);

  readonly filter = signal<string>('');
  readonly selected = signal<DsEntry | null>(null);
  readonly testStatus = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly snapshotValue = signal<unknown>(undefined);
  readonly snapshotError = signal<string | null>(null);

  readonly createDialogOpen = signal<boolean>(false);
  readonly createError = signal<string | null>(null);
  readonly newDsId = signal('');
  readonly newDsTitle = signal('');
  readonly newDsKind = signal<'transport' | 'stream' | 'local' | 'computed'>('transport');
  readonly newDsTransport = signal<'http' | 'websocket' | 'mock'>('http');
  readonly newDsEndpoint = signal('');
  readonly newDsOutputModel = signal('');
  readonly newDsInitial = signal('');
  readonly newDsFn = signal('');
  readonly newDsDeps = signal('');

  readonly allDatasources = computed<ReadonlyArray<DsEntry>>(() => {
    const out: DsEntry[] = [];

    for (const ds of this.dsStore.all()) {
      out.push({
        id: ds.id,
        source: 'standalone',
        sourceLabel: ds.title,
        kind: ds.kind,
        ...(ds.transport ? { transport: ds.transport } : {}),
        ...(ds.endpoint ? { endpoint: ds.endpoint } : {}),
        outputModelId: ds.contract.outputSchema ? Object.keys(ds.contract.outputSchema).length > 0 ? '(inline)' : undefined : undefined,
      });
    }

    const classes = getRegisteredPageClasses() as Array<{ name?: string; config?: PageConfig }>;
    for (const cls of classes) {
      const page = cls.config?.page;
      if (!page) continue;
      for (const [id, cfg] of Object.entries(page.datasources ?? {})) {
        out.push({
          id,
          source: 'page',
          sourceLabel: `📄 ${page.title ?? page.id}`,
          kind: cfg.kind ?? 'transport',
          ...(cfg.transport ? { transport: cfg.transport } : {}),
          ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
          outputModelId: (cfg as Record<string, unknown>)['outputModel'] as string | undefined,
        });
      }
    }

    for (const d of this.draftStore.all()) {
      for (const [id, cfg] of Object.entries(d.config.page.datasources ?? {})) {
        out.push({
          id,
          source: 'draft-page',
          sourceLabel: `⚡ ${d.title}`,
          kind: cfg.kind ?? 'transport',
          ...(cfg.transport ? { transport: cfg.transport } : {}),
          ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
          outputModelId: (cfg as Record<string, unknown>)['outputModel'] as string | undefined,
        });
      }
    }

    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
  });

  readonly filteredDatasources = computed<ReadonlyArray<DsEntry>>(() => {
    const q = this.filter().trim().toLowerCase();
    if (!q) return this.allDatasources();
    return this.allDatasources().filter((d) =>
      d.id.toLowerCase().includes(q) ||
      d.sourceLabel.toLowerCase().includes(q) ||
      (d.endpoint ?? '').toLowerCase().includes(q),
    );
  });

  readonly usages = computed<ReadonlyArray<{ pageTitle: string; widgetId: string; bindKey: string }>>(() => {
    const sel = this.selected();
    if (!sel) return [];
    const out: Array<{ pageTitle: string; widgetId: string; bindKey: string }> = [];
    const scan = (pageTitle: string, widgets: Record<string, { bind?: Record<string, string> }>): void => {
      for (const [wId, w] of Object.entries(widgets)) {
        for (const [k, v] of Object.entries(w.bind ?? {})) {
          if (typeof v === 'string' && (v.includes(`$ds.${sel.id}`) || v.includes(`$computed.${sel.id}`) || v.includes(`$local.${sel.id}`) || v === sel.id)) {
            out.push({ pageTitle, widgetId: wId, bindKey: k });
          }
        }
      }
    };
    const classes = getRegisteredPageClasses() as Array<{ config?: PageConfig }>;
    for (const cls of classes) {
      const p = cls.config?.page;
      if (!p) continue;
      scan(p.title ?? p.id, p.widgets ?? {});
    }
    for (const d of this.draftStore.all()) {
      scan(d.title, d.config.page.widgets ?? {});
    }
    return out;
  });

  readonly snapshotJson = computed<string>(() => {
    const err = this.snapshotError();
    if (err) return `(error) ${err}`;
    const v = this.snapshotValue();
    if (v === undefined) return '(brak snapshotu — kliknij Test)';
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
  });

  readonly selectedOutputModelId = signal<string>('');

  readonly outputSchemaPreview = computed<string | null>(() => {
    const modelId = this.selectedOutputModelId();
    if (!modelId) return null;
    const schema = this.modelStore.toSchema(modelId);
    if (!schema) return null;
    const lines: string[] = [];
    for (const [k, v] of Object.entries(schema)) {
      const req = v.required ? '' : '?';
      lines.push(`  ${k}${req}: ${v.type}${v.description ? `  // ${v.description}` : ''}`);
    }
    return `{\n${lines.join('\n')}\n}`;
  });

  setOutputModel(sel: DsEntry, modelId: string): void {
    this.selectedOutputModelId.set(modelId);
    if (sel.source === 'standalone') {
      const outputSchema = modelId ? (this.modelStore.toSchema(modelId) ?? {}) : {};
      this.dsStore.updateContract(sel.id, { outputSchema });
    }
  }

  byKind(kind: string): number {
    return this.allDatasources().filter((d) => d.kind === kind).length;
  }

  select(ds: DsEntry): void {
    this.selected.set(ds);
    this.testStatus.set('idle');
    this.snapshotValue.set(undefined);
    this.snapshotError.set(null);
  }

  formatConfig(cfg: unknown): string {
    try { return JSON.stringify(cfg, null, 2); } catch { return String(cfg); }
  }

  formatDsEntry(ds: DsEntry): string {
    if (ds.source === 'standalone') {
      const full = this.dsStore.get(ds.id);
      return full ? this.formatConfig(full) : `{ id: '${ds.id}', kind: '${ds.kind}' }`;
    }
    return this.formatConfig({ id: ds.id, kind: ds.kind, transport: ds.transport, endpoint: ds.endpoint });
  }

  /**
   * Test datasource — subskrybuje DataBus dla tego ID i pokazuje live value.
   * Dla transport DS wywołuje fetch/subscribe przez framework. Dla local/value
   * pokazuje initial value.
   */
  testDatasource(ds: DsEntry): void {
    if (!this.dataBus) {
      this.testStatus.set('error');
      this.snapshotError.set('DataBus niedostępny (uruchom w pełnej aplikacji z provideEchelon)');
      return;
    }
    this.testStatus.set('loading');
    this.snapshotError.set(null);
    try {
      const source = this.dataBus.source(ds.id as never);
      source.value$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (snapshot) => {
            if (snapshot.status === 'error') {
              this.testStatus.set('error');
              this.snapshotError.set(snapshot.error?.message ?? 'Nieznany błąd');
            } else if (snapshot.status === 'ready') {
              this.testStatus.set('ready');
              this.snapshotValue.set(snapshot.value);
            } else if (snapshot.status === 'loading') {
              this.testStatus.set('loading');
            }
          },
          error: (err) => {
            this.testStatus.set('error');
            this.snapshotError.set(err instanceof Error ? err.message : String(err));
          },
        });
      // Dla transport DS wywołaj refresh żeby zainicjować fetch
      if (ds.kind !== 'local' && typeof source.refresh === 'function') {
        source.refresh();
      }
    } catch (e) {
      this.testStatus.set('error');
      this.snapshotError.set(e instanceof Error ? e.message : String(e));
    }
  }

  openCreateDialog(): void {
    this.newDsId.set('');
    this.newDsTitle.set('');
    this.newDsKind.set('transport');
    this.newDsTransport.set('http');
    this.newDsEndpoint.set('');
    this.newDsOutputModel.set('');
    this.newDsInitial.set('');
    this.newDsFn.set('');
    this.newDsDeps.set('');
    this.createError.set(null);
    this.createDialogOpen.set(true);
  }

  closeCreateDialog(): void {
    this.createDialogOpen.set(false);
  }

  createDatasource(): void {
    this.createError.set(null);
    const id = this.newDsId().trim();
    const title = this.newDsTitle().trim();
    if (!id) { this.createError.set('Podaj ID'); return; }
    if (!title) { this.createError.set('Podaj nazwę'); return; }
    if (this.dsStore.get(id)) { this.createError.set(`DS "${id}" już istnieje`); return; }

    const outputModel = this.newDsOutputModel();
    const outputSchema = outputModel ? (this.modelStore.toSchema(outputModel) ?? {}) : {};

    this.dsStore.upsert({
      id,
      title,
      kind: this.newDsKind() as DraftDatasource['kind'],
      ...(this.newDsTransport() ? { transport: this.newDsTransport() } : {}),
      ...(this.newDsEndpoint() ? { endpoint: this.newDsEndpoint() } : {}),
      ...(this.newDsInitial() ? { initial: (() => { try { return JSON.parse(this.newDsInitial()); } catch { return this.newDsInitial(); } })() } : {}),
      ...(this.newDsFn() ? { fn: this.newDsFn() } : {}),
      ...(this.newDsDeps() ? { deps: this.newDsDeps().split(',').map((s) => s.trim()).filter(Boolean) } : {}),
      contract: {
        ...(Object.keys(outputSchema).length > 0 ? { outputSchema } : {}),
      },
    });
    this.closeCreateDialog();
  }

  deleteDatasource(ds: DsEntry): void {
    if (ds.source === 'standalone') {
      this.dsStore.remove(ds.id);
      this.selected.set(null);
    }
  }
}
