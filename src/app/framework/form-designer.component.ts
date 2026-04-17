/**
 * fx-form-designer — kreator formularzy jako niezależnych, silnie izolowanych bytów.
 *
 * Formularz NIE jest powiązany ze stroną. Jest self-contained artefaktem:
 *  - deklaruje pola (fields)
 *  - deklaruje kontrakt: requires (czego potrzebuje od rodzica) i emits (co daje)
 *  - strona/proces go osadza i podpina dane — ale formularz nic o tym nie wie
 *
 * Persystencja: DraftFormStoreService (localStorage). Formularze z zarejestrowanych
 * stron (read-only) są pokazywane jako referencja, ale edycja odbywa się tylko
 * na standalone draftach.
 */
import { computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EchelonWidget } from '@echelon-framework/runtime';
import { getRegisteredPageClasses } from '@echelon-framework/page-builders';
import type { PageConfig } from '@echelon-framework/core';
import { DraftFormStoreService, type DraftForm, type DraftFormField, type FormInputContract, type InputProperty, type PropertyType } from './designer-core';
import { type FormIntent, type ModelFieldPolicy, resolveFieldBehavior } from './draft-form-store';
import { DraftPageStoreService } from './designer-core';
import { DraftModelStoreService } from './designer-core';
import { DraftTranslationStoreService } from './draft-translation-store';

type EventAction =
  | { readonly emit: string; readonly payload?: string | Record<string, unknown> }
  | { readonly setDatasource: string; readonly from?: string }
  | { readonly clearDatasource: string }
  | { readonly call: string; readonly with?: string };

interface FormListEntry {
  readonly id: string;
  readonly title: string;
  readonly fieldsCount: number;
  readonly isStandalone: boolean;
  readonly sourceInfo?: string;
}

const FIELD_TYPES = [
  'string', 'text', 'number', 'decimal', 'integer',
  'boolean', 'checkbox', 'select', 'textarea',
  'date', 'datetime', 'email', 'password', 'url',
] as const;

function isFormWidget(type: string): boolean {
  return type.toLowerCase().includes('form');
}

@EchelonWidget({
  manifest: {
    type: 'form-designer',
    version: '1.0.0',
    category: 'designer',
    description: 'Kreator formularzy jako niezależnych bytów z kontraktem requires/emits.',
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
        <h2>📋 Formularze</h2>
        <div class="meta">
          <span>{{ allEntries().length }} formularzy</span>
          <span class="sep">·</span>
          <span>{{ formStore.all().length }} standalone</span>
        </div>
        <input type="search" class="search" placeholder="Szukaj..."
               [ngModel]="filter()" (ngModelChange)="filter.set($event)" />
        <button type="button" class="btn-new" (click)="openCreateDialog()">+ Nowy formularz</button>
      </div>

      @if (createOpen()) {
        <div class="modal-backdrop" (click)="closeCreateDialog()"></div>
        <div class="modal">
          <div class="modal-header">
            <h3>+ Nowy formularz</h3>
            <button type="button" class="btn-close" (click)="closeCreateDialog()">✕</button>
          </div>
          <div class="modal-body">
            <label class="field">
              <span class="field-label">ID</span>
              <input type="text" [ngModel]="newId()" (ngModelChange)="newId.set($event)" placeholder="np. client-registration" />
            </label>
            <label class="field">
              <span class="field-label">Nazwa</span>
              <input type="text" [ngModel]="newTitle()" (ngModelChange)="newTitle.set($event)" placeholder="np. Rejestracja klienta" />
            </label>
            <label class="field">
              <span class="field-label">Opis (opcjonalny)</span>
              <input type="text" [ngModel]="newDesc()" (ngModelChange)="newDesc.set($event)" placeholder="Formularz zbierający dane nowego klienta" />
            </label>
            @if (createError()) { <div class="error-box">{{ createError() }}</div> }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-ghost" (click)="closeCreateDialog()">Anuluj</button>
            <button type="button" class="btn-primary" (click)="createForm()">Utwórz</button>
          </div>
        </div>
      }

      <div class="layout">
        <aside class="list">
          <div class="list-header">Formularze</div>
          @for (e of filteredEntries(); track e.id + (e.sourceInfo ?? '')) {
            <button type="button" class="form-item"
                    [class.active]="selectedId() === e.id"
                    [class.standalone]="e.isStandalone"
                    (click)="select(e)">
              <div class="form-line-1">
                <span class="form-id">{{ e.id }}</span>
                @if (e.isStandalone) { <span class="badge-standalone">standalone</span> }
                @else { <span class="badge-embedded">w stronie</span> }
              </div>
              <div class="form-line-2">{{ e.title }} · {{ e.fieldsCount }} pól</div>
              @if (e.sourceInfo) { <div class="form-line-3">{{ e.sourceInfo }}</div> }
            </button>
          }
          @if (filteredEntries().length === 0) {
            <div class="empty">Brak formularzy — kliknij "+ Nowy formularz"</div>
          }
        </aside>

        <main class="detail">
          @if (selectedForm(); as form) {
            <div class="detail-header">
              <div>
                <div class="detail-title">{{ form.title || form.id }}</div>
                <div class="detail-sub">
                  <code>{{ form.id }}</code>
                  @if (form.description) { · {{ form.description }} }
                </div>
              </div>
              <div class="detail-actions">
                <button type="button" class="btn-danger" (click)="deleteForm(form.id)">🗑 Usuń</button>
              </div>
            </div>

            <!-- INTENT + OUTPUT MODEL -->
            <div class="output-model-section">
              <div class="om-header">🎯 Intent + Output Model</div>
              <div class="om-row">
                <label class="field intent-field">
                  <span class="field-label">Intent</span>
                  <select [ngModel]="form.intent ?? 'create'" (ngModelChange)="setIntent($event)">
                    <option value="create">create — nowy rekord (PK/auto pominięte)</option>
                    <option value="edit">edit — edycja istniejącego (PK readonly)</option>
                    <option value="view">view — podgląd (wszystko readonly)</option>
                    <option value="filter">filter — filtrowanie (nic required)</option>
                    <option value="patch">patch — częściowa aktualizacja (nic required)</option>
                  </select>
                </label>
              </div>
            </div>

            <div class="output-model-section">
              <div class="om-header">📐 Output Model (co formularz produkuje)</div>
              <div class="om-row">
                <select class="om-select" [ngModel]="form.outputModel ?? ''" (ngModelChange)="setOutputModel($event)">
                  <option value="">— formularz nie produkuje typed output —</option>
                  @for (m of modelStore.all(); track m.id) {
                    <option [value]="m.id">🧩 {{ m.id }} — {{ m.title }} ({{ m.fields.length }} pól)</option>
                  }
                </select>
                @if (form.outputModel) {
                  <button type="button" class="btn-generate" (click)="generateFieldsFromModel()" title="Wygeneruj pola formularza z modelu">
                    ⚡ Generuj pola z modelu
                  </button>
                }
              </div>
              @if (form.outputModel) {
                <div class="om-info">
                  @if (form.registerAsDatasource) {
                    <span class="om-badge ds">📦 Zarejestrowany jako datasource — widoczny w DS Designer jako <code>kind: form</code></span>
                  }
                  @if (missingModelFields().length > 0) {
                    <div class="om-warning">
                      ⚠ Brakujące pola modelu (required): {{ missingModelFields().join(', ') }}
                    </div>
                  } @else {
                    <span class="om-ok">✓ Formularz pokrywa wszystkie required pola modelu</span>
                  }
                </div>
              }
            </div>

            <!-- FIELD POLICIES — overrides per intent -->
            @if (form.outputModel && resolvedBehaviors().length > 0) {
              <div class="policies-section">
                <div class="pol-header">📋 Field Policies (intent: {{ form.intent ?? 'create' }})</div>
                <div class="pol-table">
                  <div class="pol-row header">
                    <span>Pole</span><span>Include</span><span>Required</span><span>ReadOnly</span><span>Override</span>
                  </div>
                  @for (rb of resolvedBehaviors(); track rb.fieldId) {
                    <div class="pol-row" [class.excluded]="!rb.include" [class.overridden]="rb.hasOverride">
                      <span class="pol-field">{{ rb.fieldId }}</span>
                      <span class="pol-bool" [class.on]="rb.include">{{ rb.include ? '✓' : '✕' }}</span>
                      <span class="pol-bool" [class.on]="rb.required">{{ rb.required ? '✓' : '—' }}</span>
                      <span class="pol-bool" [class.on]="rb.readOnly">{{ rb.readOnly ? '🔒' : '—' }}</span>
                      <button type="button" class="btn-toggle" (click)="toggleFieldPolicy(rb.fieldId, 'include')">inc</button>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- KONTRAKT — TYPED INPUT CONTRACTS -->
            <div class="contract">
              <div class="contract-section full">
                <div class="contract-header">
                  📥 Input Contracts (typed requires)
                  <button type="button" class="btn-add-mini" (click)="addContract()">+ input</button>
                </div>
                @for (c of contracts(); track $index; let ci = $index) {
                  <div class="input-contract" [class.expanded]="expandedContract() === ci">
                    <div class="ic-header" (click)="toggleContract(ci)">
                      <span class="ic-caret">{{ expandedContract() === ci ? '▾' : '▸' }}</span>
                      <span class="ic-ds">{{ c.datasourceId || '(brak id)' }}</span>
                      @if (c.alias && c.alias !== c.datasourceId) { <span class="ic-alias">as {{ c.alias }}</span> }
                      <span class="ic-props">{{ objectKeys(c.schema).length }} props</span>
                      <button type="button" class="btn-rm-mini" (click)="removeContract(ci); $event.stopPropagation()">✕</button>
                    </div>
                    @if (expandedContract() === ci) {
                      <div class="ic-body">
                        <div class="ic-row-2">
                          <label class="field"><span class="field-label">Datasource ID</span>
                            <input type="text" [ngModel]="c.datasourceId" (ngModelChange)="updateContractField(ci, 'datasourceId', $event)" placeholder="np. clientData" /></label>
                          <label class="field"><span class="field-label">Alias (wewnętrzny)</span>
                            <input type="text" [ngModel]="c.alias ?? ''" (ngModelChange)="updateContractField(ci, 'alias', $event)" placeholder="np. client" /></label>
                        </div>
                        <label class="field"><span class="field-label">Opis</span>
                          <input type="text" [ngModel]="c.description ?? ''" (ngModelChange)="updateContractField(ci, 'description', $event)" placeholder="Dane klienta z listy" /></label>

                        <div class="ic-schema">
                          <div class="ic-schema-header">
                            <span>Schema — oczekiwany kształt danych</span>
                            <select class="model-picker" (change)="fillSchemaFromModel(ci, $any($event.target).value); $any($event.target).value = ''">
                              <option value="">📥 Wypełnij z modelu...</option>
                              @for (m of modelStore.all(); track m.id) {
                                <option [value]="m.id">🧩 {{ m.id }} ({{ m.fields.length }} pól)</option>
                              }
                            </select>
                            <button type="button" class="btn-add-mini" (click)="addSchemaProperty(ci)">+ property</button>
                          </div>
                          <div class="schema-table">
                            <div class="schema-row header">
                              <span>Nazwa</span><span>Typ</span><span>Required</span><span>Opis</span><span></span>
                            </div>
                            @for (propName of objectKeys(c.schema); track propName; let pi = $index) {
                              <div class="schema-row">
                                <input type="text" [value]="propName" (change)="renameSchemaProperty(ci, propName, $any($event.target).value)" />
                                <select [value]="c.schema[propName].type" (change)="updateSchemaPropertyType(ci, propName, $any($event.target).value)">
                                  @for (t of propertyTypes; track t) { <option [value]="t">{{ t }}</option> }
                                </select>
                                <input type="checkbox" [checked]="!!c.schema[propName].required" (change)="updateSchemaPropertyRequired(ci, propName, $any($event.target).checked)" />
                                <input type="text" [value]="c.schema[propName].description ?? ''" (change)="updateSchemaPropertyDesc(ci, propName, $any($event.target).value)" placeholder="opis" />
                                <button type="button" class="btn-rm-mini" (click)="removeSchemaProperty(ci, propName)">✕</button>
                              </div>
                            }
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                }
                @if (contracts().length === 0) { <div class="contract-empty">Brak input contracts — formularz nie wymaga danych z zewnątrz</div> }
              </div>
              <div class="contract-section">
                <div class="contract-header">
                  📤 Emits (co daję na wyjściu)
                  <button type="button" class="btn-add-mini" (click)="addEmit()">+</button>
                </div>
                @for (e of form.emits; track $index; let ei = $index) {
                  <div class="contract-row">
                    <input type="text" [ngModel]="e.event" (ngModelChange)="updateEmitEvent(ei, $event)" placeholder="np. form.submitted" />
                    <input type="text" class="desc-input" [ngModel]="e.description ?? ''" (ngModelChange)="updateEmitDesc(ei, $event)" placeholder="opis" />
                    <button type="button" class="btn-rm-mini" (click)="removeEmit(ei)">✕</button>
                  </div>
                }
                @if (form.emits.length === 0) { <div class="contract-empty">Brak — formularz nic nie emituje</div> }
              </div>
            </div>

            <!-- GDZIE OSADZONY -->
            @if (usages().length > 0) {
              <div class="usages-section">
                <div class="usages-header">📌 Osadzony na stronach ({{ usages().length }})</div>
                @for (u of usages(); track u.pageId + u.widgetId) {
                  <div class="usage-row">
                    <span class="usage-page">{{ u.pageTitle }}</span>
                    <span class="usage-arrow">→</span>
                    <span class="usage-widget">{{ u.widgetId }}</span>
                    <a class="usage-link" [href]="u.route" target="_blank" title="Otwórz stronę">↗</a>
                  </div>
                }
              </div>
            } @else {
              <div class="usages-section empty-usage">
                <div class="usages-header">📌 Gdzie osadzony</div>
                <div class="usage-empty">
                  Formularz nie jest osadzony na żadnej stronie.
                  Użyj widget <code>form-ref</code> z <code>formId: '{{ form.id }}'</code> żeby go osadzić.
                </div>
              </div>
            }

            <!-- 3-COL EDITOR -->
            <div class="edit-mode">
              <div class="col-fields">
                <div class="col-header">
                  Pola <span class="count-pill">{{ form.fields.length }}</span>
                  <button type="button" class="btn-add" (click)="addField()">+ pole</button>
                </div>
                @for (field of form.fields; track $index; let i = $index) {
                  <div class="field-item" [class.active]="selectedFieldIndex() === i" (click)="selectField(i)">
                    <div class="field-item-handle">⋮⋮</div>
                    <div class="field-item-main">
                      <div class="field-item-id">{{ field.id || '(empty)' }}</div>
                      <div class="field-item-sub">{{ field.type || 'text' }}{{ field.required ? ' · req' : '' }}{{ field.width ? ' · w:' + field.width : '' }}</div>
                    </div>
                    <div class="field-item-actions">
                      <button type="button" class="btn-tiny" (click)="moveField(i, -1); $event.stopPropagation()" [disabled]="i === 0">↑</button>
                      <button type="button" class="btn-tiny" (click)="moveField(i, 1); $event.stopPropagation()" [disabled]="i === form.fields.length - 1">↓</button>
                      <button type="button" class="btn-rm" (click)="removeField(i); $event.stopPropagation()">✕</button>
                    </div>
                  </div>
                }
                @if (form.fields.length === 0) { <div class="empty-inline">Kliknij + żeby dodać pola</div> }
              </div>

              <div class="col-preview">
                <div class="col-header">Preview</div>
                <div class="preview-frame">
                  @if (form.fields.length === 0) {
                    <div class="preview-empty">Pusty formularz</div>
                  } @else {
                    <form class="preview-form" (submit)="$event.preventDefault()">
                      <div class="preview-grid">
                        @for (field of form.fields; track $index) {
                          <div class="preview-cell" [style.grid-column]="'span ' + (field.width || 12)">
                            <label class="preview-label">
                              {{ field.label || field.id }}
                              @if (field.required) { <span class="req">*</span> }
                            </label>
                            @switch (field.type) {
                              @case ('checkbox') { <input type="checkbox" disabled /> }
                              @case ('boolean') { <input type="checkbox" disabled /> }
                              @case ('textarea') { <textarea [placeholder]="field.placeholder || ''" disabled></textarea> }
                              @case ('select') {
                                <select disabled>
                                  @for (o of (field.options ?? []); track o.value) { <option>{{ o.label }}</option> }
                                </select>
                              }
                              @case ('number') { <input type="number" [placeholder]="field.placeholder || ''" disabled /> }
                              @case ('decimal') { <input type="number" step="any" [placeholder]="field.placeholder || ''" disabled /> }
                              @case ('date') { <input type="date" disabled /> }
                              @default { <input type="text" [placeholder]="field.placeholder || ''" disabled /> }
                            }
                          </div>
                        }
                      </div>
                      <button type="submit" class="preview-submit" disabled>{{ form.submitLabel || 'Zapisz' }}</button>
                    </form>
                  }
                </div>
              </div>

              <div class="col-details">
                <div class="col-header">Szczegóły pola</div>
                @if (selectedFieldIndex() !== null && form.fields[selectedFieldIndex()!]; as field) {
                  <div class="details-form">
                    <label class="field"><span class="field-label">ID</span>
                      <input type="text" [ngModel]="field.id" (ngModelChange)="updateField('id', $event)" /></label>
                    <label class="field"><span class="field-label">Label</span>
                      <input type="text" [ngModel]="field.label ?? ''" (ngModelChange)="updateField('label', $event)" /></label>
                    <label class="field"><span class="field-label">Typ</span>
                      <select [ngModel]="field.type ?? 'string'" (ngModelChange)="updateField('type', $event)">
                        @for (t of fieldTypes; track t) { <option [value]="t">{{ t }}</option> }
                      </select></label>
                    <label class="field"><span class="field-label">Placeholder</span>
                      <input type="text" [ngModel]="field.placeholder ?? ''" (ngModelChange)="updateField('placeholder', $event)" /></label>
                    <label class="field"><span class="field-label">Szerokość (1-12 cols)</span>
                      <input type="number" min="1" max="12" [ngModel]="field.width ?? 12" (ngModelChange)="updateField('width', +$event || 12)" /></label>

                    <div class="field-row">
                      <label class="check"><input type="checkbox" [ngModel]="!!field.required" (ngModelChange)="updateField('required', $event)" /> required</label>
                    </div>

                    @if (isNumericType(field.type)) {
                      <div class="field-row two">
                        <label class="field"><span class="field-label">Min</span>
                          <input type="number" [ngModel]="field.min ?? null" (ngModelChange)="updateField('min', $event === '' ? undefined : +$event)" /></label>
                        <label class="field"><span class="field-label">Max</span>
                          <input type="number" [ngModel]="field.max ?? null" (ngModelChange)="updateField('max', $event === '' ? undefined : +$event)" /></label>
                      </div>
                    }

                    @if (isStringType(field.type)) {
                      <label class="field"><span class="field-label">Pattern (regex)</span>
                        <input type="text" [ngModel]="field.pattern ?? ''" (ngModelChange)="updateField('pattern', $event)" /></label>
                    }

                    <!-- Field-level actions -->
                    <div class="actions-editor">
                      @for (phase of actionPhases; track phase) {
                        <div class="act-phase">
                          <div class="act-phase-header">
                            <span>{{ phase }}</span>
                            <span class="act-count">{{ actionsForPhase(field, phase).length }}</span>
                            <button type="button" class="btn-add-mini" (click)="addAction(phase)">+</button>
                          </div>
                          @for (act of actionsForPhase(field, phase); track $index; let ai = $index) {
                            <div class="act-row">
                              <select class="act-type" [ngModel]="actionType(act)" (ngModelChange)="updateActionType(phase, ai, $event)">
                                <option value="emit">emit</option>
                                <option value="setDatasource">setDatasource</option>
                                <option value="clearDatasource">clearDatasource</option>
                                <option value="call">call</option>
                              </select>
                              <input type="text" [ngModel]="actionPrimary(act)" (ngModelChange)="updateActionPrimary(phase, ai, $event)" [placeholder]="actionPlaceholder(act)" />
                              <button type="button" class="btn-rm-mini" (click)="removeAction(phase, ai)">✕</button>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>
                } @else {
                  <div class="details-empty">Wybierz pole z listy</div>
                }
              </div>
            </div>

          } @else if (selectedEmbedded(); as emb) {
            <!-- READ-ONLY — form z zarejestrowanej strony -->
            <div class="detail-header">
              <div>
                <div class="detail-title">{{ emb.id }}</div>
                <div class="detail-sub">Embedded w stronie — read-only</div>
              </div>
            </div>
            <div class="readonly-info">
              Ten formularz jest częścią zarejestrowanej strony. Żeby go edytować,
              utwórz standalone kopię (+ Nowy formularz) i przekopiuj konfigurację.
            </div>
          } @else {
            <div class="detail-empty">
              <div class="empty-icon">📋</div>
              <div class="empty-title">Wybierz formularz z listy</div>
              <div class="empty-desc">
                Formularz to niezależny komponent. Deklaruje czego potrzebuje (requires)
                i co zwraca (emits). Strona lub proces go osadza i podpina mu dane.
              </div>
            </div>
          }
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; padding: 16px; color: var(--ech-fg, #e5e7eb); height: 100%; }
    .wrap { display: flex; flex-direction: column; height: 100%; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #1f2937); border-radius: 6px; }

    .toolbar { display: flex; align-items: center; gap: 16px; padding: 12px 16px; border-bottom: 1px solid var(--ech-border, #1f2937); }
    .toolbar h2 { margin: 0; font-size: 15px; font-weight: 600; color: var(--ech-accent, #58a6ff); }
    .meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ech-muted, #9ca3af); }
    .sep { color: var(--ech-muted, #6b7280); }
    .search { flex: 1; max-width: 260px; padding: 6px 10px; background: var(--ech-panel-alt, #1f2937); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: 4px; font-size: 12px; }
    .btn-new { margin-left: auto; padding: 6px 14px; background: #064e3b; border: 1px solid #10b981; color: #d1fae5; border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-new:hover { background: #065f46; }

    .layout { display: grid; grid-template-columns: 260px 1fr; flex: 1; min-height: 0; }
    .list { background: var(--ech-panel-alt, #111827); border-right: 1px solid var(--ech-border, #1f2937); overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 3px; }
    .list-header { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ech-muted, #9ca3af); padding: 4px 8px 8px; font-weight: 600; }
    .empty, .empty-inline { padding: 20px 10px; text-align: center; font-size: 12px; color: var(--ech-muted, #9ca3af); font-style: italic; }
    .empty-inline { padding: 8px; text-align: left; }

    .form-item { background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); border-left: 3px solid var(--ech-border, #374151); border-radius: 3px; padding: 8px 10px; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 2px; color: var(--ech-fg, #e5e7eb); font-family: inherit; }
    .form-item:hover { border-color: #58a6ff66; }
    .form-item.active { background: #1e3a5f33; border-color: #58a6ff; border-left-color: #58a6ff; }
    .form-item.standalone { border-left-color: #10b981; }
    .form-line-1 { display: flex; align-items: center; gap: 6px; }
    .form-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; font-weight: 600; color: #93c5fd; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .badge-standalone { font-size: 8px; color: #6ee7b7; background: #064e3b; padding: 1px 5px; border-radius: 2px; text-transform: uppercase; font-weight: 600; }
    .badge-embedded { font-size: 8px; color: var(--ech-muted, #9ca3af); background: #1f2937; padding: 1px 5px; border-radius: 2px; text-transform: uppercase; }
    .form-line-2 { font-size: 10px; color: var(--ech-muted, #6b7280); }
    .form-line-3 { font-size: 9px; color: var(--ech-muted, #4b5563); }

    .detail { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
    .detail-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--ech-border, #1f2937); flex-shrink: 0; }
    .detail-title { font-size: 18px; font-weight: 700; color: var(--ech-fg, #e5e7eb); }
    .detail-sub { font-size: 12px; color: var(--ech-muted, #9ca3af); margin-top: 2px; }
    .detail-sub code { background: #1f2937; padding: 1px 5px; border-radius: 2px; color: #93c5fd; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
    .detail-actions { display: flex; gap: 6px; }
    .btn-primary { padding: 6px 14px; background: #064e3b; border: 1px solid #10b981; color: #d1fae5; border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-primary:hover { background: #065f46; }
    .btn-danger { padding: 6px 12px; background: #7f1d1d33; border: 1px solid #ef4444; color: #fecaca; border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-danger:hover { background: #7f1d1d66; }
    .btn-ghost { padding: 6px 14px; background: transparent; border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-ghost:hover { background: #1f2937; }
    .btn-close { background: transparent; border: none; color: var(--ech-muted, #9ca3af); font-size: 18px; cursor: pointer; padding: 4px 8px; }

    .readonly-info { padding: 16px; background: #1f2937; border: 1px solid var(--ech-border, #374151); border-radius: 4px; font-size: 12px; color: var(--ech-muted, #9ca3af); line-height: 1.5; }

    .contract { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .contract-section { background: var(--ech-panel-alt, #111827); border: 1px solid var(--ech-border, #1f2937); border-radius: 4px; padding: 10px; }
    .contract-header { display: flex; align-items: center; gap: 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--ech-muted, #9ca3af); font-weight: 600; margin-bottom: 6px; }
    .contract-row { display: flex; gap: 4px; margin-bottom: 3px; }
    .contract-row input { flex: 1; padding: 4px 6px; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: 2px; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .contract-row .desc-input { flex: 1.5; font-family: inherit; }
    .contract-section.full { grid-column: 1 / -1; }
    .contract-empty { font-size: 10px; color: var(--ech-muted, #6b7280); font-style: italic; padding: 2px; }

    .input-contract { background: #0b1120; border: 1px solid var(--ech-border, #1f2937); border-left: 3px solid #3b82f6; border-radius: 3px; margin-bottom: 4px; }
    .input-contract.expanded { border-left-color: #10b981; }
    .ic-header { display: flex; align-items: center; gap: 6px; padding: 7px 10px; cursor: pointer; font-size: 11px; }
    .ic-header:hover { background: #1f293744; }
    .ic-caret { color: var(--ech-muted, #6b7280); font-size: 10px; width: 12px; }
    .ic-ds { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; color: #93c5fd; }
    .ic-alias { color: #6ee7b7; font-size: 10px; }
    .ic-props { margin-left: auto; font-size: 9px; color: var(--ech-muted, #6b7280); background: #1f2937; padding: 1px 6px; border-radius: 2px; }
    .ic-body { padding: 10px; border-top: 1px solid var(--ech-border, #1f2937); display: flex; flex-direction: column; gap: 8px; }
    .ic-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

    .ic-schema { margin-top: 4px; }
    .ic-schema-header { display: flex; align-items: center; gap: 6px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--ech-muted, #9ca3af); font-weight: 600; margin-bottom: 6px; }
    .schema-table { display: flex; flex-direction: column; gap: 2px; }
    .schema-row { display: grid; grid-template-columns: 1.2fr 0.8fr 0.5fr 1.5fr 24px; gap: 3px; align-items: center; }
    .schema-row.header { font-size: 9px; text-transform: uppercase; letter-spacing: 0.2px; color: var(--ech-muted, #6b7280); font-weight: 600; padding: 2px 4px; }
    .schema-row input[type=text], .schema-row select { padding: 3px 5px; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: 2px; font-size: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .schema-row input[type=checkbox] { width: 14px; height: 14px; justify-self: center; }
    .model-picker { padding: 2px 6px; background: #1e3a5f; border: 1px solid #3b82f6; color: #93c5fd; border-radius: 2px; font-size: 9px; cursor: pointer; font-family: inherit; letter-spacing: 0; text-transform: none; }
    .btn-add-mini { margin-left: auto; background: #064e3b; border: 1px solid #10b981; color: #d1fae5; padding: 1px 8px; border-radius: 2px; cursor: pointer; font-size: 10px; font-family: inherit; letter-spacing: 0; text-transform: none; }
    .btn-add-mini:hover { background: #065f46; }
    .btn-rm-mini { background: transparent; border: 1px solid #7f1d1d66; color: #fca5a5; border-radius: 2px; font-size: 10px; cursor: pointer; padding: 2px 6px; font-family: inherit; width: 24px; flex-shrink: 0; }
    .btn-rm-mini:hover { background: #7f1d1d33; }

    .edit-mode { flex: 1; display: grid; grid-template-columns: 240px 1fr 280px; gap: 10px; min-height: 0; }
    .col-fields, .col-preview, .col-details { background: var(--ech-panel-alt, #111827); border: 1px solid var(--ech-border, #1f2937); border-radius: 4px; display: flex; flex-direction: column; min-height: 0; overflow-y: auto; }
    .col-header { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--ech-border, #1f2937); font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--ech-muted, #9ca3af); font-weight: 600; flex-shrink: 0; }
    .count-pill { background: #1e3a5f; color: #93c5fd; padding: 0 7px; border-radius: 10px; font-size: 9px; }
    .btn-add { margin-left: auto; background: #064e3b; border: 1px solid #10b981; color: #d1fae5; padding: 2px 10px; border-radius: 2px; cursor: pointer; font-size: 10px; font-family: inherit; letter-spacing: 0; text-transform: none; }

    .field-item { display: flex; align-items: center; gap: 5px; padding: 6px 8px; margin: 2px 6px; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); border-left: 3px solid transparent; border-radius: 3px; cursor: pointer; }
    .field-item:hover { border-color: #58a6ff66; }
    .field-item.active { background: #1e3a5f33; border-color: #58a6ff; border-left-color: #58a6ff; }
    .field-item-handle { color: var(--ech-muted, #6b7280); font-size: 12px; cursor: grab; }
    .field-item-main { flex: 1; min-width: 0; }
    .field-item-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #93c5fd; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .field-item-sub { font-size: 9px; color: var(--ech-muted, #9ca3af); }
    .field-item-actions { display: flex; gap: 2px; }
    .btn-tiny { background: transparent; border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); width: 20px; height: 20px; padding: 0; border-radius: 2px; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center; }
    .btn-tiny:disabled { opacity: 0.3; cursor: not-allowed; }
    .btn-rm { background: transparent; border: 1px solid #7f1d1d66; color: #fca5a5; width: 20px; height: 20px; padding: 0; border-radius: 2px; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center; }

    .col-preview { overflow-y: auto; }
    .preview-frame { flex: 1; padding: 12px; }
    .preview-empty { padding: 40px; color: var(--ech-muted, #9ca3af); font-style: italic; font-size: 12px; text-align: center; }
    .preview-form { display: flex; flex-direction: column; gap: 10px; }
    .preview-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 8px; }
    .preview-cell { display: flex; flex-direction: column; gap: 3px; }
    .preview-label { font-size: 10px; color: var(--ech-muted, #9ca3af); font-weight: 600; }
    .preview-label .req { color: #ef4444; margin-left: 2px; }
    .preview-form input, .preview-form select, .preview-form textarea { padding: 5px 8px; background: var(--ech-panel-alt, #1f2937); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: 2px; font-size: 11px; font-family: inherit; }
    .preview-form textarea { min-height: 50px; resize: vertical; }
    .preview-submit { padding: 6px 16px; background: #1e3a5f; border: 1px solid #3b82f6; color: #e0f2fe; border-radius: 3px; cursor: not-allowed; margin-top: 6px; font-family: inherit; opacity: 0.6; align-self: flex-start; font-size: 12px; }

    .details-form { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    .details-empty { padding: 40px 16px; text-align: center; color: var(--ech-muted, #9ca3af); font-size: 12px; font-style: italic; }
    .field { display: flex; flex-direction: column; gap: 2px; }
    .field-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--ech-muted, #9ca3af); font-weight: 600; }
    .field input, .field select { padding: 4px 6px; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: 2px; font-size: 11px; font-family: inherit; }
    .field-row { display: flex; gap: 6px; align-items: center; }
    .field-row.two { display: grid; grid-template-columns: 1fr 1fr; }
    .check { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--ech-fg, #e5e7eb); cursor: pointer; }
    .check input { width: 13px; height: 13px; }

    .actions-editor { margin-top: 6px; display: flex; flex-direction: column; gap: 6px; }
    .act-phase { background: #0b1120; border: 1px solid var(--ech-border, #1f2937); border-radius: 3px; padding: 6px; }
    .act-phase-header { display: flex; align-items: center; gap: 5px; font-size: 9px; text-transform: uppercase; color: #fcd34d; font-weight: 600; margin-bottom: 4px; }
    .act-count { background: #1f2937; padding: 0 5px; border-radius: 8px; font-size: 8px; color: var(--ech-muted, #9ca3af); }
    .act-row { display: grid; grid-template-columns: 80px 1fr 22px; gap: 2px; margin-bottom: 2px; }
    .act-row select, .act-row input { padding: 2px 4px; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: 2px; font-size: 9px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; }
    .modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 101; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); border-radius: 6px; width: 440px; max-width: calc(100vw - 40px); display: flex; flex-direction: column; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--ech-border, #1f2937); }
    .modal-header h3 { margin: 0; font-size: 14px; color: var(--ech-fg, #e5e7eb); font-weight: 600; }
    .modal-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--ech-border, #1f2937); }
    .error-box { padding: 8px 10px; background: #7f1d1d33; border: 1px solid #ef4444; color: #fecaca; border-radius: 3px; font-size: 11px; }

    .output-model-section { background: var(--ech-panel-alt, #111827); border: 1px solid #8b5cf633; border-radius: 4px; padding: 10px; margin-bottom: 0; }
    .om-header { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #c4b5fd; font-weight: 600; margin-bottom: 8px; }
    .om-row { display: flex; gap: 8px; align-items: center; }
    .om-select { flex: 1; padding: 6px 10px; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: 3px; font-size: 12px; font-family: inherit; }
    .btn-generate { padding: 6px 14px; background: #5b21b6; border: 1px solid #8b5cf6; color: #e9d5ff; border-radius: 3px; font-size: 11px; cursor: pointer; font-family: inherit; white-space: nowrap; }
    .btn-generate:hover { background: #6d28d9; }
    .om-info { margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
    .om-badge { font-size: 10px; padding: 3px 8px; border-radius: 3px; }
    .om-badge.ds { background: #064e3b33; color: #6ee7b7; border: 1px solid #10b98133; }
    .om-badge code { background: #0b1120; padding: 1px 4px; border-radius: 2px; color: #93c5fd; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9px; }
    .om-warning { font-size: 10px; color: #fca5a5; background: #7f1d1d22; border: 1px solid #ef444433; padding: 4px 8px; border-radius: 2px; }
    .om-ok { font-size: 10px; color: #6ee7b7; }
    .intent-field { flex: 1; }
    .intent-field select { width: 100%; }

    .policies-section { background: var(--ech-panel-alt, #111827); border: 1px solid var(--ech-border, #1f2937); border-radius: 4px; padding: 10px; }
    .pol-header { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--ech-muted, #9ca3af); font-weight: 600; margin-bottom: 6px; }
    .pol-table { display: flex; flex-direction: column; gap: 1px; }
    .pol-row { display: grid; grid-template-columns: 2fr 0.6fr 0.6fr 0.6fr 0.5fr; gap: 4px; padding: 4px 8px; align-items: center; font-size: 10px; }
    .pol-row.header { font-size: 9px; text-transform: uppercase; color: var(--ech-muted, #6b7280); font-weight: 600; background: #1f2937; border-radius: 2px; padding: 5px 8px; }
    .pol-row.excluded { opacity: 0.4; }
    .pol-row.overridden { background: #78350f11; border-left: 2px solid #f59e0b; }
    .pol-field { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #93c5fd; }
    .pol-bool { text-align: center; color: var(--ech-muted, #6b7280); }
    .pol-bool.on { color: #6ee7b7; }
    .btn-toggle { padding: 1px 6px; background: transparent; border: 1px solid var(--ech-border, #374151); color: var(--ech-muted, #9ca3af); border-radius: 2px; cursor: pointer; font-size: 9px; font-family: inherit; }
    .btn-toggle:hover { border-color: #f59e0b; color: #fcd34d; }

    .usages-section { background: var(--ech-panel-alt, #111827); border: 1px solid var(--ech-border, #1f2937); border-radius: 4px; padding: 10px; }
    .usages-section.empty-usage { border-style: dashed; border-color: #374151; }
    .usages-header { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--ech-muted, #9ca3af); font-weight: 600; margin-bottom: 6px; }
    .usage-row { display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: #0b1120; border-radius: 3px; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin-bottom: 2px; }
    .usage-page { color: var(--ech-muted, #9ca3af); }
    .usage-arrow { color: var(--ech-muted, #6b7280); }
    .usage-widget { color: #93c5fd; }
    .usage-link { color: #60a5fa; text-decoration: none; margin-left: auto; font-size: 13px; }
    .usage-link:hover { text-decoration: underline; }
    .usage-empty { font-size: 11px; color: var(--ech-muted, #6b7280); font-style: italic; line-height: 1.5; }
    .usage-empty code { background: #0b1120; padding: 1px 4px; border-radius: 2px; color: #93c5fd; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; font-style: normal; }

    .detail-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--ech-muted, #9ca3af); padding: 40px; text-align: center; }
    .empty-icon { font-size: 48px; opacity: 0.4; }
    .empty-title { font-size: 16px; font-weight: 600; color: var(--ech-fg, #e5e7eb); }
    .empty-desc { font-size: 13px; max-width: 400px; line-height: 1.5; }
  `],
})
export class FormDesignerComponent {
  readonly formStore = inject(DraftFormStoreService);
  private readonly pageStore = inject(DraftPageStoreService);
  readonly modelStore = inject(DraftModelStoreService);
  private readonly i18n = inject(DraftTranslationStoreService, { optional: true });

  readonly fieldTypes = FIELD_TYPES;
  readonly actionPhases = ['onChange', 'onBlur', 'onFocus'] as const;

  readonly filter = signal<string>('');
  readonly selectedId = signal<string | null>(null);
  readonly selectedFieldIndex = signal<number | null>(null);

  readonly propertyTypes: ReadonlyArray<PropertyType> = ['string', 'number', 'boolean', 'object', 'array', 'date', 'any'];
  readonly expandedContract = signal<number | null>(null);

  readonly contracts = computed<ReadonlyArray<FormInputContract>>(() => {
    const form = this.selectedForm();
    return form?.inputContracts ?? [];
  });

  readonly createOpen = signal<boolean>(false);
  readonly createError = signal<string | null>(null);
  readonly newId = signal<string>('');
  readonly newTitle = signal<string>('');
  readonly newDesc = signal<string>('');

  readonly allEntries = computed<ReadonlyArray<FormListEntry>>(() => {
    const out: FormListEntry[] = [];
    const storeForms = this.formStore.all();
    for (const f of storeForms) {
      out.push({ id: f.id, title: f.title, fieldsCount: f.fields.length, isStandalone: true });
    }
    const classes = getRegisteredPageClasses() as Array<{ config?: PageConfig }>;
    for (const cls of classes) {
      const p = cls.config?.page;
      if (!p) continue;
      for (const [wId, w] of Object.entries(p.widgets ?? {})) {
        const t = (w as { type?: string }).type ?? '';
        if (!isFormWidget(t)) continue;
        const fields = ((w as { options?: { fields?: unknown[] } }).options?.fields ?? []);
        out.push({ id: wId, title: `${p.title ?? p.id} / ${wId}`, fieldsCount: fields.length, isStandalone: false, sourceInfo: `strona: ${p.id}` });
      }
    }
    // eslint-disable-next-line no-console
    console.log('[form-designer] allEntries:', out.length, 'standalone:', storeForms.length, out.map((e) => e.id));
    return out;
  });

  readonly filteredEntries = computed<ReadonlyArray<FormListEntry>>(() => {
    const q = this.filter().trim().toLowerCase();
    if (!q) return this.allEntries();
    return this.allEntries().filter((e) => e.id.toLowerCase().includes(q) || e.title.toLowerCase().includes(q));
  });

  readonly usages = computed<ReadonlyArray<{ pageId: string; pageTitle: string; widgetId: string; route: string }>>(() => {
    const form = this.selectedForm();
    if (!form) return [];
    const out: Array<{ pageId: string; pageTitle: string; widgetId: string; route: string }> = [];

    const scan = (pageId: string, pageTitle: string, route: string, widgets: Record<string, unknown>): void => {
      for (const [wId, w] of Object.entries(widgets ?? {})) {
        const wAny = w as { type?: string; options?: { formId?: string } };
        if (wAny.type === 'form-ref' && wAny.options?.formId === form.id) {
          out.push({ pageId, pageTitle, widgetId: wId, route });
        }
        if (wAny.type === 'advanced-form' || wAny.type === 'validated-form') {
          const opts = (w as { options?: { formId?: string } }).options;
          if (opts?.formId === form.id) {
            out.push({ pageId, pageTitle, widgetId: wId, route });
          }
        }
      }
    };

    const classes = getRegisteredPageClasses() as Array<{ config?: PageConfig; __echelonPageMeta?: { route?: string } }>;
    for (const cls of classes) {
      const p = cls.config?.page;
      if (!p) continue;
      scan(p.id, p.title ?? p.id, cls.__echelonPageMeta?.route ?? '', (p.widgets ?? {}) as Record<string, unknown>);
    }
    for (const d of this.pageStore.all()) {
      scan(d.id, d.title, d.route, (d.config.page.widgets ?? {}) as Record<string, unknown>);
    }

    return out;
  });

  readonly selectedForm = computed<DraftForm | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.formStore.get(id);
  });

  readonly selectedEmbedded = computed<FormListEntry | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    if (this.formStore.get(id)) return null;
    return this.allEntries().find((e) => e.id === id && !e.isStandalone) ?? null;
  });

  select(e: FormListEntry): void {
    this.selectedId.set(e.id);
    this.selectedFieldIndex.set(null);
  }

  selectField(i: number): void {
    this.selectedFieldIndex.set(i);
  }

  // ─── Intent + Output Model ───

  readonly intentOptions: ReadonlyArray<FormIntent> = ['create', 'edit', 'view', 'filter', 'patch'];

  readonly resolvedBehaviors = computed<ReadonlyArray<{ fieldId: string; include: boolean; required: boolean; readOnly: boolean; hasOverride: boolean }>>(() => {
    const form = this.selectedForm();
    if (!form?.outputModel) return [];
    const model = this.modelStore.get(form.outputModel);
    if (!model) return [];
    const intent = form.intent ?? 'create';
    const policies = form.fieldPolicies ?? [];
    return model.fields.map((mf) => {
      const policy = policies.find((p) => p.fieldId === mf.id);
      const behavior = resolveFieldBehavior(mf, intent, policy);
      return { fieldId: mf.id, ...behavior, hasOverride: !!policy };
    });
  });

  readonly missingModelFields = computed<ReadonlyArray<string>>(() => {
    const form = this.selectedForm();
    if (!form?.outputModel) return [];
    const model = this.modelStore.get(form.outputModel);
    if (!model) return [];
    const intent = form.intent ?? 'create';
    const policies = form.fieldPolicies ?? [];
    const formFieldIds = new Set(form.fields.map((f) => f.id));

    return model.fields
      .filter((mf) => {
        const policy = policies.find((p) => p.fieldId === mf.id);
        const behavior = resolveFieldBehavior(mf, intent, policy);
        return behavior.include && behavior.required && !formFieldIds.has(mf.id);
      })
      .map((mf) => mf.id);
  });

  setIntent(intent: string): void {
    const form = this.selectedForm();
    if (!form) return;
    this.formStore.save({ ...form, intent: intent as FormIntent });
  }

  setOutputModel(modelId: string): void {
    const form = this.selectedForm();
    if (!form) return;
    this.formStore.setOutputModel(form.id, modelId || undefined);
  }

  toggleFieldPolicy(fieldId: string, key: 'include' | 'required' | 'readOnly'): void {
    const form = this.selectedForm();
    if (!form) return;
    const policies = [...(form.fieldPolicies ?? [])];
    const idx = policies.findIndex((p) => p.fieldId === fieldId);
    if (idx >= 0) {
      const current = policies[idx][key];
      policies[idx] = { ...policies[idx], [key]: current === undefined ? false : !current };
      if (Object.keys(policies[idx]).every((k) => k === 'fieldId' || policies[idx][k as keyof ModelFieldPolicy] === undefined)) {
        policies.splice(idx, 1);
      }
    } else {
      policies.push({ fieldId, [key]: false });
    }
    this.formStore.save({ ...form, fieldPolicies: policies });
  }

  generateFieldsFromModel(): void {
    const form = this.selectedForm();
    if (!form?.outputModel) return;
    const model = this.modelStore.get(form.outputModel);
    if (!model) return;

    const intent = form.intent ?? 'create';
    const policies = form.fieldPolicies ?? [];
    const existing = new Set(form.fields.map((f) => f.id));
    const newFields = [...form.fields];
    const typeMap: Record<string, string> = {
      string: 'text', number: 'number', boolean: 'checkbox',
      date: 'date', object: 'text', array: 'text', any: 'text',
    };

    for (const mf of model.fields) {
      if (existing.has(mf.id)) continue;
      const policy = policies.find((p) => p.fieldId === mf.id);
      const behavior = resolveFieldBehavior(mf, intent, policy);
      if (!behavior.include) continue;

      const field: DraftFormField = {
        id: mf.id,
        label: mf.label ?? mf.id,
        type: mf.ref ? 'lookup' : (typeMap[mf.type] ?? 'text'),
        required: behavior.required,
        width: mf.type === 'boolean' ? 3 : 6,
        ...(mf.enumValues ? { options: mf.enumValues.map((v) => ({ value: v, label: v })) } : {}),
        ...(mf.ref ? {
          lookupConfig: {
            sourceModel: mf.ref.modelId,
            valueField: 'id',
            displayFields: this.guessDisplayFields(mf.ref.modelId),
            searchField: this.guessSearchField(mf.ref.modelId),
            multi: mf.ref.kind === '1:N' || mf.ref.kind === 'N:M',
          },
        } : {}),
      };
      newFields.push(field);
    }

    this.formStore.updateFields(form.id, newFields);
    if (this.i18n) {
      for (const mf of model.fields) {
        this.i18n.ensureKey(`form.${form.id}.${mf.id}.label`, mf.label ?? mf.id, 'form');
      }
    }
  }

  private guessDisplayFields(modelId: string): string[] {
    const model = this.modelStore.get(modelId);
    if (!model) return ['id'];
    const nameField = model.fields.find((f) => ['name', 'title', 'label', 'description'].includes(f.id));
    const codeField = model.fields.find((f) => ['code', 'id', 'key', 'slug'].includes(f.id));
    const fields: string[] = [];
    if (nameField) fields.push(nameField.id);
    if (codeField && codeField.id !== nameField?.id) fields.push(codeField.id);
    return fields.length > 0 ? fields : [model.fields[0]?.id ?? 'id'];
  }

  private guessSearchField(modelId: string): string {
    const model = this.modelStore.get(modelId);
    if (!model) return 'name';
    const nameField = model.fields.find((f) => ['name', 'title', 'label'].includes(f.id));
    return nameField?.id ?? model.fields[0]?.id ?? 'name';
  }

  // ─── Create ───

  openCreateDialog(): void {
    this.newId.set('');
    this.newTitle.set('');
    this.newDesc.set('');
    this.createError.set(null);
    this.createOpen.set(true);
  }

  closeCreateDialog(): void {
    this.createOpen.set(false);
  }

  createForm(): void {
    const id = this.newId().trim();
    const title = this.newTitle().trim();
    if (!id) { this.createError.set('Podaj ID'); return; }
    if (!title) { this.createError.set('Podaj nazwę'); return; }
    if (this.formStore.get(id)) { this.createError.set(`Formularz "${id}" już istnieje`); return; }

    this.formStore.upsert({
      id, title,
      description: this.newDesc().trim() || undefined,
      fields: [],
      submitLabel: 'Zapisz',
      requires: [],
      emits: [{ event: `${id}.submitted`, description: 'Payload: wszystkie wartości formularza' }],
    });
    this.closeCreateDialog();
    this.selectedId.set(id);
  }

  deleteForm(id: string): void {
    if (typeof window !== 'undefined' && !window.confirm(`Usunąć formularz "${id}"?`)) return;
    this.formStore.remove(id);
    if (this.selectedId() === id) this.selectedId.set(null);
  }

  // ─── Contract: requires/emits ───

  addRequire(): void {
    const f = this.selectedForm();
    if (!f) return;
    this.formStore.save({ ...f, requires: [...f.requires, ''] });
  }

  removeRequire(i: number): void {
    const f = this.selectedForm();
    if (!f) return;
    const arr = f.requires.slice();
    arr.splice(i, 1);
    this.formStore.save({ ...f, requires: arr });
  }

  updateRequire(i: number, val: string): void {
    const f = this.selectedForm();
    if (!f) return;
    const arr = [...f.requires];
    arr[i] = val;
    this.formStore.save({ ...f, requires: arr });
  }

  addEmit(): void {
    const f = this.selectedForm();
    if (!f) return;
    this.formStore.save({ ...f, emits: [...f.emits, { event: '', description: '' }] });
  }

  removeEmit(i: number): void {
    const f = this.selectedForm();
    if (!f) return;
    const arr = f.emits.slice();
    arr.splice(i, 1);
    this.formStore.save({ ...f, emits: arr });
  }

  updateEmitEvent(i: number, val: string): void {
    const f = this.selectedForm();
    if (!f) return;
    const arr = [...f.emits];
    arr[i] = { ...arr[i], event: val };
    this.formStore.save({ ...f, emits: arr });
  }

  updateEmitDesc(i: number, val: string): void {
    const f = this.selectedForm();
    if (!f) return;
    const arr = [...f.emits];
    arr[i] = { ...arr[i], description: val || undefined };
    this.formStore.save({ ...f, emits: arr });
  }

  // ─── Input Contracts CRUD ───

  objectKeys(obj: Readonly<Record<string, unknown>>): string[] {
    return Object.keys(obj);
  }

  toggleContract(ci: number): void {
    this.expandedContract.set(this.expandedContract() === ci ? null : ci);
  }

  addContract(): void {
    const f = this.selectedForm();
    if (!f) return;
    const contracts = [...(f.inputContracts ?? []), { datasourceId: '', schema: {} } as FormInputContract];
    this.formStore.updateContracts(f.id, contracts);
    this.expandedContract.set(contracts.length - 1);
  }

  removeContract(ci: number): void {
    const f = this.selectedForm();
    if (!f?.inputContracts) return;
    const contracts = f.inputContracts.filter((_, i) => i !== ci);
    this.formStore.updateContracts(f.id, contracts);
    if (this.expandedContract() === ci) this.expandedContract.set(null);
  }

  updateContractField(ci: number, key: 'datasourceId' | 'alias' | 'description', value: string): void {
    const f = this.selectedForm();
    if (!f?.inputContracts) return;
    const contracts = [...f.inputContracts];
    contracts[ci] = { ...contracts[ci], [key]: value || undefined };
    this.formStore.updateContracts(f.id, contracts);
  }

  fillSchemaFromModel(ci: number, modelId: string): void {
    if (!modelId) return;
    const schema = this.modelStore.toSchema(modelId);
    if (!schema) return;
    const f = this.selectedForm();
    if (!f?.inputContracts) return;
    const contracts = [...f.inputContracts];
    contracts[ci] = { ...contracts[ci], schema: { ...contracts[ci].schema, ...schema } };
    this.formStore.updateContracts(f.id, contracts);
  }

  addSchemaProperty(ci: number): void {
    const f = this.selectedForm();
    if (!f?.inputContracts) return;
    const contracts = [...f.inputContracts];
    const c = contracts[ci];
    let n = 1;
    while (c.schema[`prop${n}`]) n++;
    contracts[ci] = { ...c, schema: { ...c.schema, [`prop${n}`]: { type: 'string' } } };
    this.formStore.updateContracts(f.id, contracts);
  }

  removeSchemaProperty(ci: number, propName: string): void {
    const f = this.selectedForm();
    if (!f?.inputContracts) return;
    const contracts = [...f.inputContracts];
    const c = contracts[ci];
    const { [propName]: _, ...rest } = c.schema;
    contracts[ci] = { ...c, schema: rest };
    this.formStore.updateContracts(f.id, contracts);
  }

  renameSchemaProperty(ci: number, oldName: string, newName: string): void {
    if (!newName || newName === oldName) return;
    const f = this.selectedForm();
    if (!f?.inputContracts) return;
    const contracts = [...f.inputContracts];
    const c = contracts[ci];
    const entries = Object.entries(c.schema).map(([k, v]) => [k === oldName ? newName : k, v] as const);
    contracts[ci] = { ...c, schema: Object.fromEntries(entries) };
    this.formStore.updateContracts(f.id, contracts);
  }

  updateSchemaPropertyType(ci: number, propName: string, type: string): void {
    const f = this.selectedForm();
    if (!f?.inputContracts) return;
    const contracts = [...f.inputContracts];
    const c = contracts[ci];
    contracts[ci] = { ...c, schema: { ...c.schema, [propName]: { ...c.schema[propName], type: type as PropertyType } } };
    this.formStore.updateContracts(f.id, contracts);
  }

  updateSchemaPropertyRequired(ci: number, propName: string, required: boolean): void {
    const f = this.selectedForm();
    if (!f?.inputContracts) return;
    const contracts = [...f.inputContracts];
    const c = contracts[ci];
    contracts[ci] = { ...c, schema: { ...c.schema, [propName]: { ...c.schema[propName], required } } };
    this.formStore.updateContracts(f.id, contracts);
  }

  updateSchemaPropertyDesc(ci: number, propName: string, desc: string): void {
    const f = this.selectedForm();
    if (!f?.inputContracts) return;
    const contracts = [...f.inputContracts];
    const c = contracts[ci];
    contracts[ci] = { ...c, schema: { ...c.schema, [propName]: { ...c.schema[propName], description: desc || undefined } } };
    this.formStore.updateContracts(f.id, contracts);
  }

  // ─── Fields CRUD ───

  addField(): void {
    const f = this.selectedForm();
    if (!f) return;
    const fields = [...f.fields];
    let n = fields.length + 1;
    while (fields.some((x) => x.id === `field${n}`)) n++;
    fields.push({ id: `field${n}`, label: `field${n}`, type: 'string', width: 12 });
    this.formStore.updateFields(f.id, fields);
    this.selectedFieldIndex.set(fields.length - 1);
  }

  removeField(i: number): void {
    const f = this.selectedForm();
    if (!f) return;
    const fields = [...f.fields];
    fields.splice(i, 1);
    this.formStore.updateFields(f.id, fields);
    if (this.selectedFieldIndex() === i) this.selectedFieldIndex.set(null);
  }

  moveField(i: number, delta: number): void {
    const f = this.selectedForm();
    if (!f) return;
    const fields = [...f.fields];
    const t = i + delta;
    if (t < 0 || t >= fields.length) return;
    const [moved] = fields.splice(i, 1);
    fields.splice(t, 0, moved);
    this.formStore.updateFields(f.id, fields);
    if (this.selectedFieldIndex() === i) this.selectedFieldIndex.set(t);
  }

  updateField<K extends keyof DraftFormField>(key: K, value: DraftFormField[K]): void {
    const f = this.selectedForm();
    const idx = this.selectedFieldIndex();
    if (!f || idx === null) return;
    const fields = [...f.fields];
    if (!fields[idx]) return;
    const updated = { ...fields[idx], [key]: value };
    if (value === '' || value === undefined) delete (updated as Record<string, unknown>)[key];
    fields[idx] = updated;
    this.formStore.updateFields(f.id, fields);
  }

  // ─── Helpers ───

  isNumericType(t?: string): boolean { return t === 'number' || t === 'decimal' || t === 'integer'; }
  isStringType(t?: string): boolean { return !t || t === 'string' || t === 'text' || t === 'textarea' || t === 'email' || t === 'password' || t === 'url'; }

  // ─── Field actions ───

  actionsForPhase(field: DraftFormField, phase: string): ReadonlyArray<Record<string, unknown>> {
    return (field.actions as Record<string, ReadonlyArray<Record<string, unknown>>> | undefined)?.[phase] ?? [];
  }

  actionType(a: Record<string, unknown>): string {
    if ('emit' in a) return 'emit';
    if ('setDatasource' in a) return 'setDatasource';
    if ('clearDatasource' in a) return 'clearDatasource';
    if ('call' in a) return 'call';
    return 'emit';
  }

  actionPrimary(a: Record<string, unknown>): string {
    return String(a['emit'] ?? a['setDatasource'] ?? a['clearDatasource'] ?? a['call'] ?? '');
  }

  actionPlaceholder(a: Record<string, unknown>): string {
    const t = this.actionType(a);
    if (t === 'emit') return 'event type';
    if (t === 'setDatasource') return 'ds id';
    if (t === 'clearDatasource') return 'ds id';
    if (t === 'call') return 'fn name';
    return '';
  }

  addAction(phase: string): void {
    const f = this.selectedForm();
    const idx = this.selectedFieldIndex();
    if (!f || idx === null) return;
    const fields = [...f.fields];
    const current = fields[idx];
    if (!current) return;
    const actions = { ...(current.actions ?? {}) } as Record<string, unknown[]>;
    const list = [...((actions[phase] as Record<string, unknown>[] | undefined) ?? []), { emit: '' }];
    actions[phase] = list;
    fields[idx] = { ...current, actions: actions as DraftFormField['actions'] };
    this.formStore.updateFields(f.id, fields);
  }

  removeAction(phase: string, ai: number): void {
    const f = this.selectedForm();
    const idx = this.selectedFieldIndex();
    if (!f || idx === null) return;
    const fields = [...f.fields];
    const current = fields[idx];
    if (!current?.actions) return;
    const actions = { ...current.actions } as Record<string, unknown[]>;
    const list = [...(actions[phase] ?? [])];
    list.splice(ai, 1);
    if (list.length === 0) delete actions[phase];
    else actions[phase] = list;
    fields[idx] = { ...current, actions: Object.keys(actions).length > 0 ? actions as DraftFormField['actions'] : undefined };
    this.formStore.updateFields(f.id, fields);
  }

  updateActionType(phase: string, ai: number, newType: string): void {
    this.mutateAction(phase, ai, () => {
      if (newType === 'emit') return { emit: '' };
      if (newType === 'setDatasource') return { setDatasource: '', from: '$event' };
      if (newType === 'clearDatasource') return { clearDatasource: '' };
      return { call: '' };
    });
  }

  updateActionPrimary(phase: string, ai: number, value: string): void {
    this.mutateAction(phase, ai, (a) => {
      const t = this.actionType(a);
      return { ...a, [t === 'clearDatasource' ? 'clearDatasource' : t]: value };
    });
  }

  private mutateAction(phase: string, ai: number, fn: (a: Record<string, unknown>) => Record<string, unknown>): void {
    const f = this.selectedForm();
    const idx = this.selectedFieldIndex();
    if (!f || idx === null) return;
    const fields = [...f.fields];
    const current = fields[idx];
    if (!current?.actions) return;
    const actions = { ...current.actions } as Record<string, Record<string, unknown>[]>;
    const list = [...(actions[phase] ?? [])];
    if (!list[ai]) return;
    list[ai] = fn(list[ai]);
    actions[phase] = list;
    fields[idx] = { ...current, actions: actions as DraftFormField['actions'] };
    this.formStore.updateFields(f.id, fields);
  }
}
