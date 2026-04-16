/**
 * fx-form-designer — dedykowana sekcja designera dla formularzy.
 *
 * Skanuje wszystkie strony (zarejestrowane + drafty) w poszukiwaniu widgetów
 * typu form (validated-form, modal-form, dealer-quote-form itp.) i pokazuje
 * ich listę z placeholder editor-em (fields list + widget JSON snapshot).
 *
 * Pełny 3-col editor (fields/preview/details) + field-level actions — M36+.
 */
import { computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EchelonWidget } from '@echelon-framework/runtime';
import { getRegisteredPageClasses } from '@echelon-framework/page-builders';
import type { PageConfig } from '@echelon-framework/core';
import { DraftPageStoreService } from '../services/draft-page-store.service';

interface FormWidgetEntry {
  readonly pageId: string;
  readonly pageTitle: string;
  readonly widgetInstanceId: string;
  readonly widgetType: string;
  readonly config: Record<string, unknown>;
  readonly isDraft: boolean;
  readonly fieldsCount: number;
}

const FORM_WIDGET_TYPES = new Set([
  'validated-form',
  'modal-form',
  'dealer-quote-form',
]);

function isFormWidget(type: string): boolean {
  if (FORM_WIDGET_TYPES.has(type)) return true;
  return type.toLowerCase().includes('form');
}

@EchelonWidget({
  manifest: {
    type: 'form-designer',
    version: '0.1.0',
    category: 'designer',
    description: 'Designer sekcja dla formularzy — lista + field editor (placeholder M34).',
    inputs: [],
    outputs: [],
    actions: [],
    capabilities: {},
    testability: { interactions: [], observables: ['form-designer'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-form-designer',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="wrap" data-testid="form-designer" data-echelon-state="ready">
      <div class="toolbar">
        <h2>📋 Forms Designer</h2>
        <div class="meta">
          <span>{{ allForms().length }} formularzy</span>
          <span class="sep">·</span>
          <span>{{ registeredForms() }} zarejestrowanych</span>
          <span class="sep">·</span>
          <span>{{ draftForms() }} w draftach</span>
        </div>
        <input type="search" class="search" placeholder="Szukaj po page / widget id..."
               [ngModel]="filter()" (ngModelChange)="filter.set($event)" />
      </div>

      <div class="layout">
        <aside class="list">
          <div class="list-header">Formularze</div>
          @for (f of filteredForms(); track f.pageId + f.widgetInstanceId) {
            <button type="button" class="form-item"
                    [class.active]="selected()?.widgetInstanceId === f.widgetInstanceId && selected()?.pageId === f.pageId"
                    [class.draft]="f.isDraft"
                    (click)="select(f)">
              <div class="form-line-1">
                <span class="form-id">{{ f.widgetInstanceId }}</span>
                <span class="form-type">{{ f.widgetType }}</span>
              </div>
              <div class="form-line-2">
                @if (f.isDraft) { ⚡ } @else { 📄 }
                {{ f.pageTitle }}
                <span class="fields-count">· {{ f.fieldsCount }} pól</span>
              </div>
            </button>
          }
          @if (filteredForms().length === 0) {
            <div class="empty">
              @if (filter()) {
                Brak wyników dla "{{ filter() }}"
              } @else {
                Brak formularzy — dodaj widget typu form (validated-form, modal-form) do strony
              }
            </div>
          }
        </aside>

        <main class="detail">
          @if (selected(); as sel) {
            <div class="detail-header">
              <div>
                <div class="detail-title">{{ sel.widgetInstanceId }}</div>
                <div class="detail-sub">{{ sel.widgetType }} · z {{ sel.pageTitle }}</div>
              </div>
              <div class="detail-actions">
                @if (sel.isDraft) {
                  <a [href]="'/draft/' + sel.pageId" target="_blank" class="btn-primary">🔍 Preview</a>
                }
              </div>
            </div>

            <div class="detail-block">
              <div class="block-header">Pola formularza ({{ fieldsOf(sel).length }})</div>
              @if (fieldsOf(sel).length === 0) {
                <div class="empty-inline">Brak pól — w configu nie ma 'fields' array</div>
              } @else {
                <div class="fields-table">
                  <div class="fields-row header">
                    <span>ID</span>
                    <span>Label</span>
                    <span>Typ</span>
                    <span>Walidatory</span>
                  </div>
                  @for (field of fieldsOf(sel); track field.id) {
                    <div class="fields-row">
                      <span class="fld-id">{{ field.id }}</span>
                      <span class="fld-label">{{ field.label || '—' }}</span>
                      <span class="fld-type">{{ field.type || '—' }}</span>
                      <span class="fld-valid">{{ validatorsSummary(field) }}</span>
                    </div>
                  }
                </div>
              }
            </div>

            <div class="detail-block">
              <div class="block-header">Konfiguracja widget-a (JSON)</div>
              <pre class="block-code">{{ formatConfig(sel.config) }}</pre>
            </div>

            <div class="detail-block placeholder">
              <div class="block-header">🚧 Field Editor (M36)</div>
              <p class="placeholder-text">
                Tutaj będzie dedykowany 3-col editor pól: lista fields (drag-reorder) +
                live preview + details panel z akcjami per pole (onChange/onBlur/onSubmit).
                Wymaga rozszerzenia <code>FormFieldDef.actions</code> w framework-u (M37)
                oraz bump-a widgets-core do rc.17.
              </p>
            </div>
          } @else {
            <div class="detail-empty">
              <div class="empty-icon">📋</div>
              <div class="empty-title">Wybierz formularz z listy</div>
              <div class="empty-desc">Zobacz pola, konfigurację widget-a i (docelowo) edytuj akcje per pole.</div>
            </div>
          }
        </main>
      </div>
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

    .form-item { background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); border-left: 3px solid var(--border, #374151); border-radius: 3px; padding: 8px 10px; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 3px; color: var(--fg, #e5e7eb); font-family: inherit; }
    .form-item:hover { border-color: #58a6ff66; }
    .form-item.active { background: #1e3a5f33; border-color: #58a6ff; border-left-color: #58a6ff; }
    .form-item.draft { border-left-color: #f59e0b; }
    .form-line-1 { display: flex; align-items: center; gap: 6px; }
    .form-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; font-weight: 600; color: #93c5fd; flex: 1; }
    .form-type { font-size: 9px; color: var(--muted, #9ca3af); background: #1f2937; padding: 1px 6px; border-radius: 2px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .form-line-2 { font-size: 10px; color: var(--muted, #6b7280); }
    .fields-count { margin-left: 4px; color: #6ee7b7; }

    .detail { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
    .detail-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border, #1f2937); }
    .detail-title { font-size: 18px; font-weight: 700; color: var(--fg, #e5e7eb); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .detail-sub { font-size: 12px; color: var(--muted, #9ca3af); margin-top: 2px; }
    .detail-actions { display: flex; gap: 6px; }
    .btn-primary { padding: 6px 14px; background: #1e3a5f; border: 1px solid #3b82f6; color: #e0f2fe; border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; text-decoration: none; display: inline-flex; align-items: center; }
    .btn-primary:hover { background: #1e40af; }

    .detail-block { background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 4px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .detail-block.placeholder { background: #78350f1a; border-color: #f59e0b66; border-style: dashed; }
    .block-header { display: flex; align-items: center; gap: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #9ca3af); font-weight: 600; }
    .placeholder-text { margin: 0; font-size: 12px; color: #fcd34d; line-height: 1.5; }
    .placeholder-text code { background: #0b1120; padding: 1px 5px; border-radius: 2px; color: #93c5fd; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
    .block-code { margin: 0; padding: 10px; background: #0b1120; border-radius: 3px; font-size: 11px; color: #d1d5db; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow-x: auto; max-height: 300px; white-space: pre-wrap; word-break: break-all; }

    .fields-table { display: flex; flex-direction: column; gap: 2px; }
    .fields-row { display: grid; grid-template-columns: 1fr 1.2fr 0.8fr 1.4fr; gap: 8px; padding: 6px 10px; background: #0b1120; border-radius: 3px; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .fields-row.header { background: #1f2937; color: var(--muted, #9ca3af); font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.3px; }
    .fld-id { color: #93c5fd; font-weight: 600; }
    .fld-label { color: var(--fg, #e5e7eb); }
    .fld-type { color: #d8b4fe; }
    .fld-valid { color: #6ee7b7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .detail-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--muted, #9ca3af); padding: 40px; text-align: center; }
    .empty-icon { font-size: 48px; opacity: 0.4; }
    .empty-title { font-size: 16px; font-weight: 600; color: var(--fg, #e5e7eb); }
    .empty-desc { font-size: 13px; }
  `],
})
export class FormDesignerComponent {
  private readonly draftStore = inject(DraftPageStoreService);

  readonly filter = signal<string>('');
  readonly selected = signal<FormWidgetEntry | null>(null);

  readonly allForms = computed<ReadonlyArray<FormWidgetEntry>>(() => {
    const out: FormWidgetEntry[] = [];

    const scan = (pageId: string, pageTitle: string, widgets: Record<string, unknown>, isDraft: boolean): void => {
      for (const [instId, w] of Object.entries(widgets ?? {})) {
        const wAny = w as { type?: string; widget?: string; options?: Record<string, unknown>; bind?: Record<string, unknown> };
        const widgetType = wAny.type ?? wAny.widget ?? '';
        if (!isFormWidget(widgetType)) continue;
        const opts = wAny.options ?? {};
        const fields = (opts['fields'] as ReadonlyArray<unknown>) ?? [];
        out.push({
          pageId,
          pageTitle,
          widgetInstanceId: instId,
          widgetType,
          config: wAny as Record<string, unknown>,
          isDraft,
          fieldsCount: fields.length,
        });
      }
    };

    const classes = getRegisteredPageClasses() as Array<{ config?: PageConfig }>;
    for (const cls of classes) {
      const p = cls.config?.page;
      if (!p) continue;
      scan(p.id, p.title ?? p.id, (p.widgets ?? {}) as Record<string, unknown>, false);
    }
    for (const d of this.draftStore.all()) {
      scan(d.id, d.title, (d.config.page.widgets ?? {}) as Record<string, unknown>, true);
    }

    out.sort((a, b) => a.widgetInstanceId.localeCompare(b.widgetInstanceId));
    return out;
  });

  readonly filteredForms = computed<ReadonlyArray<FormWidgetEntry>>(() => {
    const q = this.filter().trim().toLowerCase();
    if (!q) return this.allForms();
    return this.allForms().filter((f) =>
      f.widgetInstanceId.toLowerCase().includes(q) ||
      f.pageTitle.toLowerCase().includes(q) ||
      f.widgetType.toLowerCase().includes(q),
    );
  });

  readonly registeredForms = computed<number>(() => this.allForms().filter((f) => !f.isDraft).length);
  readonly draftForms = computed<number>(() => this.allForms().filter((f) => f.isDraft).length);

  select(f: FormWidgetEntry): void {
    this.selected.set(f);
  }

  fieldsOf(f: FormWidgetEntry): ReadonlyArray<{ id: string; label?: string; type?: string; validators?: unknown }> {
    const opts = (f.config['options'] as Record<string, unknown> | undefined) ?? {};
    const fields = opts['fields'] as ReadonlyArray<{ id: string; label?: string; type?: string; validators?: unknown }> | undefined;
    return fields ?? [];
  }

  validatorsSummary(field: { validators?: unknown; required?: boolean; min?: number; max?: number; pattern?: string }): string {
    const parts: string[] = [];
    if (field.required) parts.push('required');
    if (field.min !== undefined) parts.push(`min:${field.min}`);
    if (field.max !== undefined) parts.push(`max:${field.max}`);
    if (field.pattern) parts.push('pattern');
    if (Array.isArray(field.validators) && field.validators.length > 0) {
      parts.push(`${field.validators.length} validator(s)`);
    }
    return parts.length > 0 ? parts.join(', ') : '—';
  }

  formatConfig(cfg: Record<string, unknown>): string {
    try { return JSON.stringify(cfg, null, 2); } catch { return String(cfg); }
  }
}
