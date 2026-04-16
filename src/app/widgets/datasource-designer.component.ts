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
import { DraftPageStoreService } from '../services/draft-page-store.service';

interface DraftDsForm {
  targetPageId: string;
  dsId: string;
  kind: 'transport' | 'local' | 'computed';
  transport: 'http' | 'websocket' | 'mock';
  endpoint: string;
  valueJson: string;
  computedExpr: string;
  computedDeps: string;
}

interface DsEntry {
  readonly id: string;
  readonly pageId: string;
  readonly pageTitle: string;
  readonly config: DatasourceConfig;
  readonly kind: string;
  readonly transport?: string;
  readonly endpoint?: string;
  readonly isDraft: boolean;
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
        <button type="button" class="btn-new" (click)="openCreateDialog()"
                [disabled]="draftStore.all().length === 0"
                [title]="draftStore.all().length === 0 ? 'Musisz mieć co najmniej 1 draft page — stwórz w Pages Designer' : 'Dodaj nowy datasource do wybranego drafta'">
          + Nowy
        </button>
      </div>

      <div class="layout">
        <aside class="list">
          <div class="list-header">Źródła danych</div>
          @for (ds of filteredDatasources(); track ds.id + ds.pageId) {
            <button type="button" class="ds-item"
                    [class.active]="selected()?.id === ds.id && selected()?.pageId === ds.pageId"
                    [class.draft]="ds.isDraft"
                    (click)="select(ds)">
              <div class="ds-line-1">
                <span class="ds-id">{{ ds.id }}</span>
                <span class="ds-kind">{{ ds.kind }}</span>
              </div>
              <div class="ds-line-2">
                <span class="ds-page" title="Strona która definiuje ten datasource">
                  @if (ds.isDraft) { ⚡ } @else { 📄 }
                  {{ ds.pageTitle }}
                </span>
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
                <div class="detail-sub">{{ sel.kind }}{{ sel.transport ? ' · ' + sel.transport : '' }} · z {{ sel.pageTitle }}</div>
              </div>
              <div class="detail-actions">
                <button type="button" (click)="testDatasource(sel)" class="btn-primary">▶ Test / Snapshot</button>
                @if (sel.isDraft) {
                  <button type="button" (click)="deleteDatasource(sel)" class="btn-danger" title="Usuń z drafta">🗑 Usuń</button>
                }
              </div>
            </div>

            <div class="detail-grid">
              <div class="detail-block">
                <div class="block-header">Konfiguracja</div>
                <pre class="block-code">{{ formatConfig(sel.config) }}</pre>
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
                  @for (u of usages(); track u.pageId + u.widgetId + u.bindKey) {
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
              <span class="field-label">Draft page (target)</span>
              <select [ngModel]="form().targetPageId" (ngModelChange)="updateForm('targetPageId', $event)">
                @for (d of draftStore.all(); track d.id) {
                  <option [value]="d.id">{{ d.title }} ({{ d.id }})</option>
                }
              </select>
            </label>

            <label class="field">
              <span class="field-label">ID (identyfikator)</span>
              <input type="text" [ngModel]="form().dsId" (ngModelChange)="updateForm('dsId', $event)" placeholder="np. clientsList" />
            </label>

            <label class="field">
              <span class="field-label">Rodzaj</span>
              <select [ngModel]="form().kind" (ngModelChange)="updateForm('kind', $event)">
                <option value="transport">transport — http/websocket</option>
                <option value="local">local — statyczna wartość (JSON)</option>
                <option value="computed">computed — wyliczana z innych ds</option>
              </select>
            </label>

            @if (form().kind === 'transport') {
              <label class="field">
                <span class="field-label">Transport</span>
                <select [ngModel]="form().transport" (ngModelChange)="updateForm('transport', $event)">
                  <option value="http">http</option>
                  <option value="websocket">websocket</option>
                  <option value="mock">mock</option>
                </select>
              </label>
              <label class="field">
                <span class="field-label">Endpoint</span>
                <input type="text" [ngModel]="form().endpoint" (ngModelChange)="updateForm('endpoint', $event)" placeholder="/api/clients" />
              </label>
            }

            @if (form().kind === 'local') {
              <label class="field">
                <span class="field-label">Initial value (JSON)</span>
                <textarea rows="4" [ngModel]="form().valueJson" (ngModelChange)="updateForm('valueJson', $event)" placeholder='np. "hello" albo { "a": 1 }'></textarea>
              </label>
            }

            @if (form().kind === 'computed') {
              <label class="field">
                <span class="field-label">Wyrażenie (funkcja)</span>
                <input type="text" [ngModel]="form().computedExpr" (ngModelChange)="updateForm('computedExpr', $event)" placeholder="np. sumPnl" />
              </label>
              <label class="field">
                <span class="field-label">Dependencies (CSV ds ids)</span>
                <input type="text" [ngModel]="form().computedDeps" (ngModelChange)="updateForm('computedDeps', $event)" placeholder="positionsList,spotRate" />
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
    :host { display: block; padding: 16px; color: var(--fg, #e5e7eb); height: 100%; }
    .wrap { display: flex; flex-direction: column; height: 100%; background: var(--panel, #0f172a); border: 1px solid var(--border, #1f2937); border-radius: 6px; }

    .toolbar { display: flex; align-items: center; gap: 16px; padding: 12px 16px; border-bottom: 1px solid var(--border, #1f2937); }
    .toolbar h2 { margin: 0; font-size: 15px; font-weight: 600; color: var(--accent, #58a6ff); }
    .meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted, #9ca3af); }
    .sep { color: var(--muted, #6b7280); }
    .search { flex: 1; max-width: 300px; padding: 6px 10px; background: var(--panel-alt, #1f2937); border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 4px; font-size: 12px; margin-left: auto; }

    .layout { display: grid; grid-template-columns: 320px 1fr; flex: 1; min-height: 0; }
    .list { background: var(--panel-alt, #111827); border-right: 1px solid var(--border, #1f2937); overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 3px; }
    .list-header { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #9ca3af); padding: 4px 8px 8px; font-weight: 600; }
    .empty, .empty-inline { padding: 20px 10px; text-align: center; font-size: 12px; color: var(--muted, #9ca3af); font-style: italic; }
    .empty-inline { padding: 8px; text-align: left; }

    .ds-item { background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); border-left: 3px solid var(--border, #374151); border-radius: 3px; padding: 8px 10px; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 3px; color: var(--fg, #e5e7eb); font-family: inherit; }
    .ds-item:hover { border-color: #58a6ff66; }
    .ds-item.active { background: #1e3a5f33; border-color: #58a6ff; border-left-color: #58a6ff; }
    .ds-item.draft { border-left-color: #f59e0b; }
    .ds-line-1 { display: flex; align-items: center; gap: 6px; }
    .ds-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; font-weight: 600; color: #93c5fd; flex: 1; }
    .ds-kind { font-size: 9px; color: var(--muted, #9ca3af); background: #1f2937; padding: 1px 6px; border-radius: 2px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .ds-line-2 { font-size: 10px; color: var(--muted, #6b7280); }
    .ds-line-3 { font-size: 10px; color: #6ee7b7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ds-line-3 code { background: transparent; color: inherit; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; }

    .detail { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
    .detail-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border, #1f2937); }
    .detail-title { font-size: 18px; font-weight: 700; color: var(--fg, #e5e7eb); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .detail-sub { font-size: 12px; color: var(--muted, #9ca3af); margin-top: 2px; }
    .detail-actions { display: flex; gap: 6px; }
    .btn-primary { padding: 6px 14px; background: #1e3a5f; border: 1px solid #3b82f6; color: #e0f2fe; border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-primary:hover { background: #1e40af; }

    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .detail-block { grid-column: 1 / -1; background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 4px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .detail-block:nth-child(1), .detail-block:nth-child(2) { grid-column: span 1; }
    .block-header { display: flex; align-items: center; gap: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #9ca3af); font-weight: 600; }
    .block-code { margin: 0; padding: 10px; background: #0b1120; border-radius: 3px; font-size: 11px; color: #d1d5db; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow-x: auto; max-height: 300px; white-space: pre-wrap; word-break: break-all; }

    .status { margin-left: auto; font-size: 10px; padding: 1px 6px; border-radius: 2px; }
    .status.loading { background: #713f1233; color: #fcd34d; }
    .status.ready { background: #064e3b33; color: #10b981; }
    .status.error { background: #7f1d1d33; color: #fee2e2; }
    .status.idle { background: #1f2937; color: var(--muted, #6b7280); }

    .usage-list { display: flex; flex-direction: column; gap: 4px; }
    .usage-row { display: flex; align-items: center; gap: 4px; padding: 5px 8px; background: #0b1120; border-radius: 3px; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .usage-page { color: var(--muted, #9ca3af); }
    .usage-arrow { color: var(--muted, #6b7280); }
    .usage-widget { color: #93c5fd; }
    .usage-key { color: #6ee7b7; }

    .detail-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--muted, #9ca3af); padding: 40px; text-align: center; }
    .empty-icon { font-size: 48px; opacity: 0.4; }
    .empty-title { font-size: 16px; font-weight: 600; color: var(--fg, #e5e7eb); }
    .empty-desc { font-size: 13px; }

    .btn-new { padding: 6px 14px; background: #064e3b; border: 1px solid #10b981; color: #d1fae5; border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-new:hover:not(:disabled) { background: #065f46; }
    .btn-new:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-danger { padding: 6px 12px; background: #7f1d1d33; border: 1px solid #ef4444; color: #fecaca; border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-danger:hover { background: #7f1d1d66; }
    .btn-ghost { padding: 6px 14px; background: transparent; border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-ghost:hover { background: #1f2937; }
    .btn-close { background: transparent; border: none; color: var(--muted, #9ca3af); font-size: 18px; cursor: pointer; padding: 4px 8px; }
    .btn-close:hover { color: var(--fg, #e5e7eb); }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; }
    .modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 101; background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); border-radius: 6px; width: 480px; max-width: calc(100vw - 40px); max-height: calc(100vh - 80px); display: flex; flex-direction: column; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border, #1f2937); }
    .modal-header h3 { margin: 0; font-size: 14px; color: var(--fg, #e5e7eb); font-weight: 600; }
    .modal-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--border, #1f2937); }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--muted, #9ca3af); font-weight: 600; }
    .field input, .field select, .field textarea { padding: 6px 10px; background: var(--panel-alt, #1f2937); border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 3px; font-size: 12px; font-family: inherit; }
    .field textarea { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; resize: vertical; }
    .error-box { padding: 8px 10px; background: #7f1d1d33; border: 1px solid #ef4444; color: #fecaca; border-radius: 3px; font-size: 11px; }
  `],
})
export class DatasourceDesignerComponent {
  readonly draftStore = inject(DraftPageStoreService);
  private readonly dataBus = inject(DATA_BUS, { optional: true }) as DataBus | null;
  private readonly destroyRef = inject(DestroyRef);

  readonly filter = signal<string>('');
  readonly selected = signal<DsEntry | null>(null);
  readonly testStatus = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly snapshotValue = signal<unknown>(undefined);
  readonly snapshotError = signal<string | null>(null);

  readonly createDialogOpen = signal<boolean>(false);
  readonly createError = signal<string | null>(null);
  readonly form = signal<DraftDsForm>(this.emptyForm());

  readonly allDatasources = computed<ReadonlyArray<DsEntry>>(() => {
    const out: DsEntry[] = [];

    // Zarejestrowane strony
    const classes = getRegisteredPageClasses() as Array<{ name?: string; config?: PageConfig }>;
    for (const cls of classes) {
      const page = cls.config?.page;
      if (!page) continue;
      for (const [id, cfg] of Object.entries(page.datasources ?? {})) {
        const entry: DsEntry = {
          id,
          pageId: page.id,
          pageTitle: page.title ?? page.id,
          config: cfg,
          kind: cfg.kind ?? 'transport',
          isDraft: false,
          ...(cfg.transport ? { transport: cfg.transport } : {}),
          ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
        };
        out.push(entry);
      }
    }

    // Draft pages
    for (const d of this.draftStore.all()) {
      for (const [id, cfg] of Object.entries(d.config.page.datasources ?? {})) {
        const entry: DsEntry = {
          id,
          pageId: d.id,
          pageTitle: d.title,
          config: cfg,
          kind: cfg.kind ?? 'transport',
          isDraft: true,
          ...(cfg.transport ? { transport: cfg.transport } : {}),
          ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
        };
        out.push(entry);
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
      d.pageTitle.toLowerCase().includes(q) ||
      (d.endpoint ?? '').toLowerCase().includes(q),
    );
  });

  readonly usages = computed<ReadonlyArray<{ pageId: string; pageTitle: string; widgetId: string; bindKey: string }>>(() => {
    const sel = this.selected();
    if (!sel) return [];
    const out: Array<{ pageId: string; pageTitle: string; widgetId: string; bindKey: string }> = [];
    const scan = (pageId: string, pageTitle: string, widgets: Record<string, { bind?: Record<string, string> }>): void => {
      for (const [wId, w] of Object.entries(widgets)) {
        for (const [k, v] of Object.entries(w.bind ?? {})) {
          if (typeof v === 'string' && (v.includes(`$ds.${sel.id}`) || v.includes(`$computed.${sel.id}`) || v.includes(`$local.${sel.id}`) || v === sel.id)) {
            out.push({ pageId, pageTitle, widgetId: wId, bindKey: k });
          }
        }
      }
    };
    const classes = getRegisteredPageClasses() as Array<{ config?: PageConfig }>;
    for (const cls of classes) {
      const p = cls.config?.page;
      if (!p) continue;
      scan(p.id, p.title ?? p.id, p.widgets ?? {});
    }
    for (const d of this.draftStore.all()) {
      scan(d.id, d.title, d.config.page.widgets ?? {});
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

  byKind(kind: string): number {
    return this.allDatasources().filter((d) => d.kind === kind).length;
  }

  select(ds: DsEntry): void {
    this.selected.set(ds);
    this.testStatus.set('idle');
    this.snapshotValue.set(undefined);
    this.snapshotError.set(null);
  }

  formatConfig(cfg: DatasourceConfig): string {
    try { return JSON.stringify(cfg, null, 2); } catch { return String(cfg); }
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

  private emptyForm(): DraftDsForm {
    const firstDraft = this.draftStore.all()[0];
    return {
      targetPageId: firstDraft?.id ?? '',
      dsId: '',
      kind: 'transport',
      transport: 'http',
      endpoint: '',
      valueJson: '',
      computedExpr: '',
      computedDeps: '',
    };
  }

  openCreateDialog(): void {
    this.form.set(this.emptyForm());
    this.createError.set(null);
    this.createDialogOpen.set(true);
  }

  closeCreateDialog(): void {
    this.createDialogOpen.set(false);
  }

  updateForm<K extends keyof DraftDsForm>(key: K, value: DraftDsForm[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  createDatasource(): void {
    this.createError.set(null);
    const f = this.form();
    const draft = this.draftStore.get(f.targetPageId);
    if (!draft) { this.createError.set('Nieznany target draft'); return; }
    if (!f.dsId.trim()) { this.createError.set('Podaj ID datasource'); return; }
    if (draft.config.page.datasources?.[f.dsId]) { this.createError.set(`ds "${f.dsId}" już istnieje w tym draft-cie`); return; }

    let cfg: DatasourceConfig;
    try {
      if (f.kind === 'transport') {
        if (!f.endpoint.trim()) { this.createError.set('Podaj endpoint'); return; }
        cfg = { kind: 'transport', transport: f.transport, endpoint: f.endpoint } as DatasourceConfig;
      } else if (f.kind === 'local') {
        let initial: unknown = undefined;
        if (f.valueJson.trim()) {
          try { initial = JSON.parse(f.valueJson); }
          catch { initial = f.valueJson; }
        }
        cfg = { kind: 'local', initial } as DatasourceConfig;
      } else {
        if (!f.computedExpr.trim()) { this.createError.set('Podaj nazwę funkcji computed'); return; }
        const deps = f.computedDeps.split(',').map((s) => s.trim()).filter(Boolean);
        cfg = { kind: 'computed', fn: f.computedExpr, deps } as DatasourceConfig;
      }
    } catch (e) {
      this.createError.set(e instanceof Error ? e.message : String(e));
      return;
    }

    const nextConfig: PageConfig = {
      ...draft.config,
      page: {
        ...draft.config.page,
        datasources: {
          ...(draft.config.page.datasources ?? {}),
          [f.dsId]: cfg,
        },
      },
    };
    this.draftStore.update(draft.id, nextConfig);
    this.closeCreateDialog();
  }

  deleteDatasource(ds: DsEntry): void {
    if (!ds.isDraft) return;
    const draft = this.draftStore.get(ds.pageId);
    if (!draft) return;
    const current = draft.config.page.datasources ?? {};
    const { [ds.id]: _removed, ...rest } = current;
    const nextConfig: PageConfig = {
      ...draft.config,
      page: { ...draft.config.page, datasources: rest },
    };
    this.draftStore.update(draft.id, nextConfig);
    this.selected.set(null);
  }
}
