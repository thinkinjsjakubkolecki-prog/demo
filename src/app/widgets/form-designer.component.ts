/**
 * fx-form-designer — dedykowana sekcja designera dla formularzy.
 *
 * Dla zarejestrowanych stron (@Page classes) pokazujemy read-only table
 * pól + JSON configu.
 *
 * Dla draft-pages (localStorage) udostępniamy 3-col edit mode (M36):
 *   [fields list]  [visual preview]  [field details]
 *
 * Pełne field-level actions (onChange/onBlur/onSubmit) → M37-M38 po
 * bump-ie widgets-core rc.17.
 */
import { computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EchelonWidget } from '@echelon-framework/runtime';
import { getRegisteredPageClasses } from '@echelon-framework/page-builders';
import type { PageConfig } from '@echelon-framework/core';
import { DraftPageStoreService } from '../services/draft-page-store.service';

type EventAction =
  | { readonly emit: string; readonly payload?: string | Record<string, unknown> }
  | { readonly setDatasource: string; readonly from?: string }
  | { readonly clearDatasource: string }
  | { readonly call: string; readonly with?: string };

interface FieldActions {
  onChange?: ReadonlyArray<EventAction>;
  onBlur?: ReadonlyArray<EventAction>;
  onFocus?: ReadonlyArray<EventAction>;
}

interface FormFieldDef {
  id: string;
  label?: string;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  placeholder?: string;
  options?: ReadonlyArray<{ value: string; label: string }>;
  actions?: FieldActions;
}

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

const FIELD_TYPES = [
  'string', 'text', 'number', 'decimal', 'integer',
  'boolean', 'checkbox', 'select', 'textarea',
  'date', 'datetime', 'email', 'password', 'url',
] as const;

function isFormWidget(type: string): boolean {
  if (FORM_WIDGET_TYPES.has(type)) return true;
  return type.toLowerCase().includes('form');
}

@EchelonWidget({
  manifest: {
    type: 'form-designer',
    version: '0.2.0',
    category: 'designer',
    description: 'Designer sekcja dla formularzy — lista + 3-col edit mode dla draft pages.',
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
        <button type="button" class="btn-new" (click)="openCreateFormDialog()"
                [disabled]="draftStore.all().length === 0"
                [title]="draftStore.all().length === 0 ? 'Stwórz draft page najpierw w Pages Designer' : 'Dodaj formularz do wybranego drafta'">
          + Nowy formularz
        </button>
      </div>

      @if (createFormOpen()) {
        <div class="modal-backdrop" (click)="closeCreateFormDialog()"></div>
        <div class="modal">
          <div class="modal-header">
            <h3>+ Nowy formularz</h3>
            <button type="button" class="btn-close" (click)="closeCreateFormDialog()">✕</button>
          </div>
          <div class="modal-body">
            <label class="field">
              <span class="field-label">Draft page (target)</span>
              <select [ngModel]="newFormPageId()" (ngModelChange)="newFormPageId.set($event)">
                @for (d of draftStore.all(); track d.id) {
                  <option [value]="d.id">{{ d.title }} ({{ d.id }})</option>
                }
              </select>
            </label>
            <label class="field">
              <span class="field-label">Widget ID</span>
              <input type="text" [ngModel]="newFormWidgetId()" (ngModelChange)="newFormWidgetId.set($event)" placeholder="np. registrationForm" />
            </label>
            <label class="field">
              <span class="field-label">Typ widget-a</span>
              <select [ngModel]="newFormWidgetType()" (ngModelChange)="newFormWidgetType.set($event)">
                <option value="advanced-form">advanced-form (z per-field actions)</option>
                <option value="validated-form">validated-form (framework)</option>
              </select>
            </label>
            @if (createFormError()) { <div class="error-box">{{ createFormError() }}</div> }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-ghost" (click)="closeCreateFormDialog()">Anuluj</button>
            <button type="button" class="btn-primary" (click)="createForm()">Utwórz</button>
          </div>
        </div>
      }

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
                <div class="detail-sub">
                  {{ sel.widgetType }} · z {{ sel.pageTitle }}
                  @if (sel.isDraft) { <span class="badge-draft">DRAFT — edytowalny</span> }
                  @else { <span class="badge-locked">ZAREJESTROWANA — read-only</span> }
                </div>
              </div>
              <div class="detail-actions">
                @if (sel.isDraft) {
                  <a [href]="'/draft/' + sel.pageId" target="_blank" class="btn-primary">🔍 Preview</a>
                }
              </div>
            </div>

            @if (sel.isDraft) {
              <!-- EDIT MODE — 3-col layout (M36) -->
              <div class="edit-mode">
                <div class="col-fields">
                  <div class="col-header">
                    Pola <span class="count-pill">{{ currentFields().length }}</span>
                    <button type="button" class="btn-add" (click)="addField()" title="Dodaj pole">+ pole</button>
                  </div>
                  @for (field of currentFields(); track $index; let i = $index) {
                    <div class="field-item" [class.active]="selectedFieldIndex() === i" (click)="selectField(i)">
                      <div class="field-item-handle">⋮⋮</div>
                      <div class="field-item-main">
                        <div class="field-item-id">{{ field.id || '(empty)' }}</div>
                        <div class="field-item-sub">{{ field.type || '—' }}{{ field.required ? ' · required' : '' }}</div>
                      </div>
                      <div class="field-item-actions">
                        <button type="button" class="btn-tiny" (click)="moveField(i, -1); $event.stopPropagation()" [disabled]="i === 0" title="Do góry">↑</button>
                        <button type="button" class="btn-tiny" (click)="moveField(i, 1); $event.stopPropagation()" [disabled]="i === currentFields().length - 1" title="Do dołu">↓</button>
                        <button type="button" class="btn-rm" (click)="removeField(i); $event.stopPropagation()" title="Usuń">✕</button>
                      </div>
                    </div>
                  }
                  @if (currentFields().length === 0) {
                    <div class="empty-inline">Brak pól — kliknij + żeby dodać</div>
                  }
                </div>

                <div class="col-preview">
                  <div class="col-header">Preview</div>
                  <div class="preview-frame">
                    @if (currentFields().length === 0) {
                      <div class="preview-empty">Pusty formularz</div>
                    } @else {
                      <form class="preview-form" (submit)="$event.preventDefault()">
                        @for (field of currentFields(); track $index) {
                          <div class="preview-field">
                            <label class="preview-label">
                              {{ field.label || field.id }}
                              @if (field.required) { <span class="req">*</span> }
                            </label>
                            @switch (field.type) {
                              @case ('boolean') { <input type="checkbox" disabled /> }
                              @case ('checkbox') { <input type="checkbox" disabled /> }
                              @case ('textarea') { <textarea [placeholder]="field.placeholder || ''" disabled></textarea> }
                              @case ('select') {
                                <select disabled>
                                  @for (opt of (field.options ?? []); track opt.value) {
                                    <option [value]="opt.value">{{ opt.label }}</option>
                                  }
                                </select>
                              }
                              @case ('number') { <input type="number" [placeholder]="field.placeholder || ''" disabled /> }
                              @case ('decimal') { <input type="number" step="any" [placeholder]="field.placeholder || ''" disabled /> }
                              @case ('integer') { <input type="number" step="1" [placeholder]="field.placeholder || ''" disabled /> }
                              @case ('date') { <input type="date" disabled /> }
                              @case ('datetime') { <input type="datetime-local" disabled /> }
                              @case ('email') { <input type="email" [placeholder]="field.placeholder || ''" disabled /> }
                              @case ('password') { <input type="password" [placeholder]="field.placeholder || ''" disabled /> }
                              @default { <input type="text" [placeholder]="field.placeholder || ''" disabled /> }
                            }
                          </div>
                        }
                        <button type="submit" class="preview-submit" disabled>Submit</button>
                      </form>
                    }
                  </div>
                  <div class="preview-note">
                    Uproszczony wizualny preview. Pełne live-renderowanie (z walidacją, bindingami, akcjami) —
                    otwórz <a [href]="'/draft/' + sel.pageId" target="_blank">preview drafta</a>.
                  </div>
                </div>

                <div class="col-details">
                  <div class="col-header">Szczegóły pola</div>
                  @if (selectedFieldIndex() !== null && currentFields()[selectedFieldIndex()!]; as field) {
                    <div class="details-form">
                      <label class="field">
                        <span class="field-label">ID</span>
                        <input type="text" [ngModel]="field.id" (ngModelChange)="updateField('id', $event)" />
                      </label>
                      <label class="field">
                        <span class="field-label">Label</span>
                        <input type="text" [ngModel]="field.label ?? ''" (ngModelChange)="updateField('label', $event)" />
                      </label>
                      <label class="field">
                        <span class="field-label">Typ</span>
                        <select [ngModel]="field.type ?? 'string'" (ngModelChange)="updateField('type', $event)">
                          @for (t of fieldTypes; track t) { <option [value]="t">{{ t }}</option> }
                        </select>
                      </label>
                      <label class="field">
                        <span class="field-label">Placeholder</span>
                        <input type="text" [ngModel]="field.placeholder ?? ''" (ngModelChange)="updateField('placeholder', $event)" />
                      </label>

                      <div class="field-row">
                        <label class="check">
                          <input type="checkbox" [ngModel]="!!field.required" (ngModelChange)="updateField('required', $event)" />
                          <span>required</span>
                        </label>
                      </div>

                      @if (isNumericType(field.type)) {
                        <div class="field-row two">
                          <label class="field">
                            <span class="field-label">Min</span>
                            <input type="number" [ngModel]="field.min ?? null" (ngModelChange)="updateField('min', $event === '' ? undefined : +$event)" />
                          </label>
                          <label class="field">
                            <span class="field-label">Max</span>
                            <input type="number" [ngModel]="field.max ?? null" (ngModelChange)="updateField('max', $event === '' ? undefined : +$event)" />
                          </label>
                        </div>
                      }

                      @if (isStringType(field.type)) {
                        <label class="field">
                          <span class="field-label">Pattern (regex)</span>
                          <input type="text" [ngModel]="field.pattern ?? ''" (ngModelChange)="updateField('pattern', $event)" placeholder="^\\d{3}-\\d{3}$" />
                        </label>
                      }

                      <div class="actions-editor">
                        @for (phase of actionPhases; track phase) {
                          <div class="act-phase">
                            <div class="act-phase-header">
                              <span>{{ phase }}</span>
                              <span class="act-count">{{ actionsFor(field, phase).length }}</span>
                              <button type="button" class="btn-add-mini" (click)="addAction(phase)">+ akcja</button>
                            </div>
                            @for (act of actionsFor(field, phase); track $index; let ai = $index) {
                              <div class="act-row">
                                <select class="act-type" [ngModel]="actionType(act)"
                                        (ngModelChange)="updateActionType(phase, ai, $event)">
                                  <option value="emit">emit</option>
                                  <option value="setDatasource">setDatasource</option>
                                  <option value="clearDatasource">clearDatasource</option>
                                  <option value="call">call</option>
                                </select>
                                <input type="text" class="act-val" [placeholder]="actionPlaceholder(act)"
                                       [ngModel]="actionPrimary(act)"
                                       (ngModelChange)="updateActionPrimary(phase, ai, $event)" />
                                @if (actionType(act) === 'emit' || actionType(act) === 'setDatasource' || actionType(act) === 'call') {
                                  <input type="text" class="act-from" placeholder="from/payload/with"
                                         [ngModel]="actionSecondary(act)"
                                         (ngModelChange)="updateActionSecondary(phase, ai, $event)" />
                                }
                                <button type="button" class="btn-rm-mini" (click)="removeAction(phase, ai)">✕</button>
                              </div>
                            }
                            @if (actionsFor(field, phase).length === 0) {
                              <div class="act-empty">Brak akcji</div>
                            }
                          </div>
                        }
                        <div class="actions-hint">
                          Akcje wykonywane przez <code>fx-advanced-form</code>. Użyj <code>$event</code> w
                          <code>from</code>/<code>payload</code> żeby odnosić się do wartości pola.
                        </div>
                      </div>
                    </div>
                  } @else {
                    <div class="details-empty">Wybierz pole z listy po lewej</div>
                  }
                </div>
              </div>
            } @else {
              <!-- READ-ONLY MODE — zarejestrowana strona -->
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
            }
          } @else {
            <div class="detail-empty">
              <div class="empty-icon">📋</div>
              <div class="empty-title">Wybierz formularz z listy</div>
              <div class="empty-desc">Zobacz pola i edytuj (jeśli to draft) lub zobacz konfigurację (zarejestrowane).</div>
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

    .layout { display: grid; grid-template-columns: 280px 1fr; flex: 1; min-height: 0; }
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

    .detail { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; min-width: 0; }
    .detail-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border, #1f2937); flex-shrink: 0; }
    .detail-title { font-size: 18px; font-weight: 700; color: var(--fg, #e5e7eb); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .detail-sub { font-size: 12px; color: var(--muted, #9ca3af); margin-top: 2px; display: flex; align-items: center; gap: 8px; }
    .badge-draft { background: #713f1233; border: 1px solid #f59e0b; color: #fcd34d; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; }
    .badge-locked { background: #1f2937; border: 1px solid #374151; color: var(--muted, #9ca3af); padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; }
    .detail-actions { display: flex; gap: 6px; }
    .btn-primary { padding: 6px 14px; background: #1e3a5f; border: 1px solid #3b82f6; color: #e0f2fe; border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; text-decoration: none; display: inline-flex; align-items: center; }
    .btn-primary:hover { background: #1e40af; }

    .edit-mode { flex: 1; display: grid; grid-template-columns: 280px 1fr 320px; gap: 12px; min-height: 0; min-width: 0; }
    .col-fields, .col-preview, .col-details { background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 4px; display: flex; flex-direction: column; min-height: 0; }
    .col-header { display: flex; align-items: center; gap: 6px; padding: 10px 12px; border-bottom: 1px solid var(--border, #1f2937); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #9ca3af); font-weight: 600; flex-shrink: 0; }
    .count-pill { background: #1e3a5f; color: #93c5fd; padding: 0 8px; border-radius: 10px; font-size: 10px; letter-spacing: 0; }

    .col-fields { padding-bottom: 8px; overflow-y: auto; }
    .field-item { display: flex; align-items: center; gap: 6px; padding: 8px 10px; margin: 3px 8px; background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); border-left: 3px solid transparent; border-radius: 3px; cursor: pointer; }
    .field-item:hover { border-color: #58a6ff66; }
    .field-item.active { background: #1e3a5f33; border-color: #58a6ff; border-left-color: #58a6ff; }
    .field-item-handle { color: var(--muted, #6b7280); font-size: 14px; cursor: grab; }
    .field-item-main { flex: 1; min-width: 0; }
    .field-item-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #93c5fd; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .field-item-sub { font-size: 10px; color: var(--muted, #9ca3af); }
    .field-item-actions { display: flex; gap: 2px; }
    .btn-tiny, .btn-rm { background: transparent; border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); width: 22px; height: 22px; padding: 0; border-radius: 2px; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center; font-family: inherit; }
    .btn-tiny:hover { background: #1f2937; }
    .btn-tiny:disabled { opacity: 0.3; cursor: not-allowed; }
    .btn-rm { color: #fca5a5; border-color: #7f1d1d66; }
    .btn-rm:hover { background: #7f1d1d33; }
    .btn-add { margin-left: auto; background: #064e3b; border: 1px solid #10b981; color: #d1fae5; padding: 2px 10px; border-radius: 2px; cursor: pointer; font-size: 11px; letter-spacing: 0; text-transform: none; font-family: inherit; }
    .btn-add:hover { background: #065f46; }

    .col-preview { overflow-y: auto; }
    .preview-frame { flex: 1; padding: 16px; display: flex; align-items: flex-start; justify-content: center; }
    .preview-empty { padding: 40px; color: var(--muted, #9ca3af); font-style: italic; font-size: 12px; }
    .preview-form { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 420px; }
    .preview-field { display: flex; flex-direction: column; gap: 4px; }
    .preview-label { font-size: 11px; color: var(--muted, #9ca3af); font-weight: 600; }
    .preview-label .req { color: #ef4444; margin-left: 2px; }
    .preview-form input, .preview-form select, .preview-form textarea { padding: 6px 10px; background: var(--panel-alt, #1f2937); border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 3px; font-size: 12px; font-family: inherit; }
    .preview-form textarea { min-height: 60px; resize: vertical; }
    .preview-submit { padding: 8px 20px; background: #1e3a5f; border: 1px solid #3b82f6; color: #e0f2fe; border-radius: 3px; cursor: not-allowed; margin-top: 4px; font-family: inherit; opacity: 0.6; }
    .preview-note { padding: 8px 12px; border-top: 1px solid var(--border, #1f2937); font-size: 10px; color: var(--muted, #6b7280); font-style: italic; }
    .preview-note a { color: #60a5fa; }

    .col-details { overflow-y: auto; }
    .details-form { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
    .details-empty { padding: 40px 16px; text-align: center; color: var(--muted, #9ca3af); font-size: 12px; font-style: italic; }
    .field { display: flex; flex-direction: column; gap: 3px; }
    .field-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--muted, #9ca3af); font-weight: 600; }
    .field input, .field select, .field textarea { padding: 5px 8px; background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 2px; font-size: 11px; font-family: inherit; }
    .field-row { display: flex; gap: 8px; align-items: center; }
    .field-row.two { display: grid; grid-template-columns: 1fr 1fr; }
    .check { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--fg, #e5e7eb); cursor: pointer; }
    .check input { width: 14px; height: 14px; }

    .actions-editor { margin-top: 8px; display: flex; flex-direction: column; gap: 8px; }
    .act-phase { background: #0b1120; border: 1px solid var(--border, #1f2937); border-radius: 3px; padding: 8px; }
    .act-phase-header { display: flex; align-items: center; gap: 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--muted, #9ca3af); font-weight: 600; margin-bottom: 6px; }
    .act-phase-header span:first-child { color: #fcd34d; }
    .act-count { background: #1f2937; padding: 0 6px; border-radius: 8px; font-size: 9px; }
    .btn-add-mini { margin-left: auto; background: #064e3b; border: 1px solid #10b981; color: #d1fae5; padding: 1px 8px; border-radius: 2px; cursor: pointer; font-size: 10px; font-family: inherit; letter-spacing: 0; text-transform: none; }
    .btn-add-mini:hover { background: #065f46; }
    .act-row { display: grid; grid-template-columns: 95px 1fr 1fr 24px; gap: 3px; margin-bottom: 3px; }
    .act-row select, .act-row input { padding: 3px 5px; background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 2px; font-size: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .btn-rm-mini { background: transparent; border: 1px solid #7f1d1d66; color: #fca5a5; border-radius: 2px; font-size: 10px; cursor: pointer; padding: 0; font-family: inherit; }
    .btn-rm-mini:hover { background: #7f1d1d33; }
    .act-empty { font-size: 10px; color: var(--muted, #6b7280); font-style: italic; padding: 2px 4px; }
    .actions-hint { font-size: 10px; color: var(--muted, #9ca3af); font-style: italic; padding: 4px 2px; line-height: 1.4; }
    .actions-hint code { background: #0b1120; padding: 1px 4px; border-radius: 2px; color: #93c5fd; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; font-style: normal; }

    .detail-block { background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 4px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .block-header { display: flex; align-items: center; gap: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #9ca3af); font-weight: 600; }
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

    .btn-new { padding: 6px 14px; background: #064e3b; border: 1px solid #10b981; color: #d1fae5; border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-new:hover:not(:disabled) { background: #065f46; }
    .btn-new:disabled { opacity: 0.4; cursor: not-allowed; }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; }
    .modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 101; background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); border-radius: 6px; width: 460px; max-width: calc(100vw - 40px); display: flex; flex-direction: column; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border, #1f2937); }
    .modal-header h3 { margin: 0; font-size: 14px; color: var(--fg, #e5e7eb); font-weight: 600; }
    .modal-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--border, #1f2937); }
    .btn-ghost { padding: 6px 14px; background: transparent; border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-ghost:hover { background: #1f2937; }
    .btn-close { background: transparent; border: none; color: var(--muted, #9ca3af); font-size: 18px; cursor: pointer; padding: 4px 8px; }
    .error-box { padding: 8px 10px; background: #7f1d1d33; border: 1px solid #ef4444; color: #fecaca; border-radius: 3px; font-size: 11px; }
  `],
})
export class FormDesignerComponent {
  readonly draftStore = inject(DraftPageStoreService);

  readonly fieldTypes = FIELD_TYPES;

  readonly createFormOpen = signal<boolean>(false);
  readonly createFormError = signal<string | null>(null);
  readonly newFormPageId = signal<string>('');
  readonly newFormWidgetId = signal<string>('');
  readonly newFormWidgetType = signal<string>('advanced-form');
  readonly actionPhases = ['onChange', 'onBlur', 'onFocus'] as const;

  readonly filter = signal<string>('');
  readonly selected = signal<FormWidgetEntry | null>(null);
  readonly selectedFieldIndex = signal<number | null>(null);

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

  /** Live fields z draft store dla bieżącego selected. Zmienia się przy edycji. */
  readonly currentFields = computed<ReadonlyArray<FormFieldDef>>(() => {
    const sel = this.selected();
    if (!sel || !sel.isDraft) return this.fieldsOf(sel ?? { pageId: '', pageTitle: '', widgetInstanceId: '', widgetType: '', config: {}, isDraft: false, fieldsCount: 0 }) as ReadonlyArray<FormFieldDef>;
    const draft = this.draftStore.get(sel.pageId);
    if (!draft) return [];
    const w = draft.config.page.widgets?.[sel.widgetInstanceId] as { options?: { fields?: ReadonlyArray<FormFieldDef> } } | undefined;
    return w?.options?.fields ?? [];
  });

  select(f: FormWidgetEntry): void {
    this.selected.set(f);
    this.selectedFieldIndex.set(null);
  }

  selectField(i: number): void {
    this.selectedFieldIndex.set(i);
  }

  isNumericType(t?: string): boolean {
    return t === 'number' || t === 'decimal' || t === 'integer';
  }

  isStringType(t?: string): boolean {
    return !t || t === 'string' || t === 'text' || t === 'textarea' || t === 'email' || t === 'password' || t === 'url';
  }

  fieldsOf(f: FormWidgetEntry): ReadonlyArray<FormFieldDef> {
    const opts = (f.config['options'] as Record<string, unknown> | undefined) ?? {};
    const fields = opts['fields'] as ReadonlyArray<FormFieldDef> | undefined;
    return fields ?? [];
  }

  validatorsSummary(field: FormFieldDef & { validators?: unknown }): string {
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

  addField(): void {
    const sel = this.selected();
    if (!sel || !sel.isDraft) return;
    const fields = this.currentFields().slice();
    const nextId = this.nextFieldId(fields);
    fields.push({ id: nextId, label: nextId, type: 'string' });
    this.saveFields(sel, fields);
    this.selectedFieldIndex.set(fields.length - 1);
  }

  removeField(i: number): void {
    const sel = this.selected();
    if (!sel || !sel.isDraft) return;
    const fields = this.currentFields().slice();
    fields.splice(i, 1);
    this.saveFields(sel, fields);
    if (this.selectedFieldIndex() === i) this.selectedFieldIndex.set(null);
    else if ((this.selectedFieldIndex() ?? -1) > i) {
      this.selectedFieldIndex.update((v) => (v === null ? null : v - 1));
    }
  }

  moveField(i: number, delta: number): void {
    const sel = this.selected();
    if (!sel || !sel.isDraft) return;
    const fields = this.currentFields().slice();
    const target = i + delta;
    if (target < 0 || target >= fields.length) return;
    const [moved] = fields.splice(i, 1);
    fields.splice(target, 0, moved);
    this.saveFields(sel, fields);
    const curSel = this.selectedFieldIndex();
    if (curSel === i) this.selectedFieldIndex.set(target);
    else if (curSel === target) this.selectedFieldIndex.set(i);
  }

  updateField<K extends keyof FormFieldDef>(key: K, value: FormFieldDef[K]): void {
    const sel = this.selected();
    const idx = this.selectedFieldIndex();
    if (!sel || !sel.isDraft || idx === null) return;
    const fields = this.currentFields().slice();
    if (!fields[idx]) return;
    const updated: FormFieldDef = { ...fields[idx], [key]: value };
    // Usuń klucze z pustymi wartościami żeby JSON nie puchnął
    if (value === '' || value === undefined) {
      delete updated[key];
    }
    fields[idx] = updated;
    this.saveFields(sel, fields);
  }

  // ─── Field actions chain editor (M38) ───

  actionsFor(field: FormFieldDef, phase: typeof this.actionPhases[number]): ReadonlyArray<EventAction> {
    return field.actions?.[phase] ?? [];
  }

  actionType(a: EventAction): string {
    if ('emit' in a) return 'emit';
    if ('setDatasource' in a) return 'setDatasource';
    if ('clearDatasource' in a) return 'clearDatasource';
    if ('call' in a) return 'call';
    return 'emit';
  }

  actionPrimary(a: EventAction): string {
    if ('emit' in a) return a.emit;
    if ('setDatasource' in a) return a.setDatasource;
    if ('clearDatasource' in a) return a.clearDatasource;
    if ('call' in a) return a.call;
    return '';
  }

  actionSecondary(a: EventAction): string {
    if ('emit' in a) return typeof a.payload === 'string' ? a.payload : (a.payload ? JSON.stringify(a.payload) : '');
    if ('setDatasource' in a) return a.from ?? '';
    if ('call' in a) return a.with ?? '';
    return '';
  }

  actionPlaceholder(a: EventAction): string {
    const t = this.actionType(a);
    if (t === 'emit') return 'event.type np. fx.amount.changed';
    if (t === 'setDatasource') return 'target ds id';
    if (t === 'clearDatasource') return 'ds id do wyczyszczenia';
    if (t === 'call') return 'computed fn name';
    return '';
  }

  addAction(phase: typeof this.actionPhases[number]): void {
    const sel = this.selected();
    const idx = this.selectedFieldIndex();
    if (!sel || !sel.isDraft || idx === null) return;
    const fields = this.currentFields().slice();
    const current = fields[idx];
    if (!current) return;
    const actions = { ...(current.actions ?? {}) };
    const list = [...(actions[phase] ?? []), { emit: '' } as EventAction];
    actions[phase] = list;
    fields[idx] = { ...current, actions };
    this.saveFields(sel, fields);
  }

  removeAction(phase: typeof this.actionPhases[number], ai: number): void {
    const sel = this.selected();
    const idx = this.selectedFieldIndex();
    if (!sel || !sel.isDraft || idx === null) return;
    const fields = this.currentFields().slice();
    const current = fields[idx];
    if (!current?.actions?.[phase]) return;
    const actions = { ...current.actions };
    const list = actions[phase]!.slice();
    list.splice(ai, 1);
    if (list.length === 0) delete actions[phase];
    else actions[phase] = list;
    fields[idx] = { ...current, actions: Object.keys(actions).length > 0 ? actions : undefined };
    this.saveFields(sel, fields);
  }

  updateActionType(phase: typeof this.actionPhases[number], ai: number, newType: string): void {
    this.mutateAction(phase, ai, () => {
      if (newType === 'emit') return { emit: '' };
      if (newType === 'setDatasource') return { setDatasource: '', from: '$event' };
      if (newType === 'clearDatasource') return { clearDatasource: '' };
      if (newType === 'call') return { call: '' };
      return { emit: '' };
    });
  }

  updateActionPrimary(phase: typeof this.actionPhases[number], ai: number, value: string): void {
    this.mutateAction(phase, ai, (a) => {
      const t = this.actionType(a);
      if (t === 'emit') return { ...a, emit: value } as EventAction;
      if (t === 'setDatasource') return { ...a, setDatasource: value } as EventAction;
      if (t === 'clearDatasource') return { clearDatasource: value } as EventAction;
      if (t === 'call') return { ...a, call: value } as EventAction;
      return a;
    });
  }

  updateActionSecondary(phase: typeof this.actionPhases[number], ai: number, value: string): void {
    this.mutateAction(phase, ai, (a) => {
      const t = this.actionType(a);
      if (t === 'emit') {
        const payload: unknown = value ? value : undefined;
        const next = { ...a } as Record<string, unknown>;
        if (payload === undefined) delete next['payload'];
        else next['payload'] = payload;
        return next as EventAction;
      }
      if (t === 'setDatasource') {
        const next = { ...a } as Record<string, unknown>;
        if (!value) delete next['from'];
        else next['from'] = value;
        return next as EventAction;
      }
      if (t === 'call') {
        const next = { ...a } as Record<string, unknown>;
        if (!value) delete next['with'];
        else next['with'] = value;
        return next as EventAction;
      }
      return a;
    });
  }

  private mutateAction(phase: typeof this.actionPhases[number], ai: number, mutator: (a: EventAction) => EventAction): void {
    const sel = this.selected();
    const idx = this.selectedFieldIndex();
    if (!sel || !sel.isDraft || idx === null) return;
    const fields = this.currentFields().slice();
    const current = fields[idx];
    if (!current?.actions?.[phase]) return;
    const actions = { ...current.actions };
    const list = actions[phase]!.slice();
    const curAct = list[ai];
    if (!curAct) return;
    list[ai] = mutator(curAct);
    actions[phase] = list;
    fields[idx] = { ...current, actions };
    this.saveFields(sel, fields);
  }

  private nextFieldId(existing: ReadonlyArray<FormFieldDef>): string {
    let n = existing.length + 1;
    while (existing.some((f) => f.id === `field${n}`)) n++;
    return `field${n}`;
  }

  private saveFields(sel: FormWidgetEntry, fields: ReadonlyArray<FormFieldDef>): void {
    const draft = this.draftStore.get(sel.pageId);
    if (!draft) return;
    const widgetsAny = { ...(draft.config.page.widgets ?? {}) } as unknown as Record<string, Record<string, unknown>>;
    const current = widgetsAny[sel.widgetInstanceId];
    if (!current) return;
    widgetsAny[sel.widgetInstanceId] = {
      ...current,
      options: { ...((current['options'] as Record<string, unknown>) ?? {}), fields },
    };
    const nextConfig: PageConfig = {
      ...draft.config,
      page: { ...draft.config.page, widgets: widgetsAny as unknown as PageConfig['page']['widgets'] },
    };
    this.draftStore.update(draft.id, nextConfig);
  }

  // ─── Create new form ───

  openCreateFormDialog(): void {
    const first = this.draftStore.all()[0];
    this.newFormPageId.set(first?.id ?? '');
    this.newFormWidgetId.set('');
    this.newFormWidgetType.set('advanced-form');
    this.createFormError.set(null);
    this.createFormOpen.set(true);
  }

  closeCreateFormDialog(): void {
    this.createFormOpen.set(false);
  }

  createForm(): void {
    this.createFormError.set(null);
    const pageId = this.newFormPageId();
    const widgetId = this.newFormWidgetId().trim();
    const widgetType = this.newFormWidgetType();

    if (!pageId) { this.createFormError.set('Wybierz target draft page'); return; }
    if (!widgetId) { this.createFormError.set('Podaj widget ID'); return; }

    const draft = this.draftStore.get(pageId);
    if (!draft) { this.createFormError.set('Draft nie znaleziony'); return; }

    const widgets = { ...(draft.config.page.widgets ?? {}) } as unknown as Record<string, Record<string, unknown>>;
    if (widgets[widgetId]) { this.createFormError.set(`Widget "${widgetId}" już istnieje w tym drafcie`); return; }

    widgets[widgetId] = {
      type: widgetType,
      options: { fields: [], submitLabel: 'Zapisz' },
    };

    const layout = draft.config.page.layout ?? { type: 'grid', cols: 12, items: [] };
    const items = [...((layout as unknown as { items?: unknown[] }).items ?? []), { widget: widgetId, x: 0, y: 100, w: 12, h: 8 }];

    const nextConfig: PageConfig = {
      ...draft.config,
      page: {
        ...draft.config.page,
        widgets: widgets as unknown as PageConfig['page']['widgets'],
        layout: { ...layout, items } as PageConfig['page']['layout'],
      },
    };
    this.draftStore.update(draft.id, nextConfig);
    this.closeCreateFormDialog();
  }
}
