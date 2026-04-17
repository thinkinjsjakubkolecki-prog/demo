/**
 * fx-form-ref — widget osadzający standalone formularz z DraftFormStore.
 *
 * Strona nie zna pól — podaje tylko formId + bind dla requires.
 * Widget ładuje DraftForm z store i renderuje jako advanced-form.
 *
 * Użycie w PageBuilder:
 *   .widget('txForm', { x: 0, y: 0, w: 12 }, widget.any('form-ref', {
 *     options: { formId: 'fx-spot-transaction' },
 *     bind: { clientData: 'selectedClient', spotPricing: 'spotUsdPln' },
 *   }))
 */
import {
  computed,
  effect,
  EventEmitter,
  inject,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EchelonWidget, DATA_BUS } from '@echelon-framework/runtime';
import type { DataBus } from '@echelon-framework/core';
import { DraftFormStoreService, type DraftForm, type DraftFormField, DraftModelStoreService, DraftDatasourceStoreService } from './designer-core';
import { DataContextService } from './data-context.service';
import { resolveFieldBehavior, type FormIntent } from './draft-form-store';

@EchelonWidget({
  manifest: {
    type: 'form-ref',
    version: '1.0.0',
    category: 'data',
    description: 'Osadza standalone formularz z DraftFormStore przez referencję (formId).',
    inputs: [
      { name: 'formId', type: 'string', required: true },
    ],
    outputs: [
      { name: 'submit', eventType: 'form-ref.submit' },
      { name: 'change', eventType: 'form-ref.change' },
    ],
    actions: [],
    capabilities: { dataBus: 'read', eventBus: 'emit' },
    testability: { interactions: [{ action: 'submit' }], observables: ['formId'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-form-ref',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="form-ref" data-testid="widget-form-ref" data-echelon-state="ready">
      @if (form(); as f) {
        <div class="ref-header">
          <span class="ref-title">{{ f.title }}</span>
          <span class="ref-id">{{ f.id }}</span>
          @if (f.description) { <span class="ref-desc">{{ f.description }}</span> }
        </div>
        <form class="ref-form" (submit)="onSubmit($event)">
          <div class="ref-grid">
            @for (field of f.fields; track field.id) {
              <div class="ref-cell" [style.grid-column]="'span ' + (field.width || 12)">
                <label class="ref-label">
                  {{ field.label || field.id }}
                  @if (field.required) { <span class="req">*</span> }
                </label>
                @switch (field.type) {
                  @case ('checkbox') {
                    <input type="checkbox" [name]="field.id"
                           [checked]="!!values()[field.id]"
                           (change)="setValue(field, $any($event.target).checked)" />
                  }
                  @case ('boolean') {
                    <input type="checkbox" [name]="field.id"
                           [checked]="!!values()[field.id]"
                           (change)="setValue(field, $any($event.target).checked)" />
                  }
                  @case ('textarea') {
                    <textarea [name]="field.id" [placeholder]="field.placeholder || ''"
                              [value]="values()[field.id] ?? ''"
                              (input)="setValue(field, $any($event.target).value)"></textarea>
                  }
                  @case ('select') {
                    <select [name]="field.id" [value]="values()[field.id] ?? ''"
                            (change)="setValue(field, $any($event.target).value)">
                      <option value="">—</option>
                      @for (o of (field.options ?? []); track o.value) {
                        <option [value]="o.value">{{ o.label }}</option>
                      }
                    </select>
                  }
                  @case ('number') {
                    <input type="number" [name]="field.id" [placeholder]="field.placeholder || ''"
                           [value]="values()[field.id] ?? ''"
                           (input)="setValue(field, +$any($event.target).value)" />
                  }
                  @case ('decimal') {
                    <input type="number" step="any" [name]="field.id" [placeholder]="field.placeholder || ''"
                           [value]="values()[field.id] ?? ''"
                           (input)="setValue(field, +$any($event.target).value)" />
                  }
                  @case ('date') {
                    <input type="date" [name]="field.id"
                           [value]="values()[field.id] ?? ''"
                           (input)="setValue(field, $any($event.target).value)" />
                  }
                  @case ('lookup') {
                    <div class="ref-lookup">
                      <input type="text" class="ref-lookup-search" [placeholder]="'Szukaj ' + (field.label || field.id) + '...'"
                             [ngModel]="lookupQueries()[field.id] ?? ''"
                             (ngModelChange)="onLookupSearch(field, $event)"
                             (focus)="openLookup(field.id)" (blur)="closeLookupDelayed(field.id)" />
                      @if (lookupOpen()[field.id]) {
                        <div class="ref-lookup-dropdown">
                          @if (lookupResults()[field.id]?.length) {
                            @for (item of lookupResults()[field.id]; track item.value) {
                              <div class="ref-lookup-option" (mousedown)="selectLookup(field, item)">
                                {{ item.display }}
                              </div>
                            }
                          } @else {
                            <div class="ref-lookup-empty">Brak wyników</div>
                          }
                        </div>
                      }
                      @if (field.lookupConfig?.multi && lookupSelected()[field.id]?.length) {
                        <div class="ref-lookup-chips">
                          @for (sel of lookupSelected()[field.id]; track sel.value) {
                            <span class="ref-lookup-chip">{{ sel.display }} <button type="button" (click)="removeLookupSelection(field, sel.value)">✕</button></span>
                          }
                        </div>
                      } @else if (!field.lookupConfig?.multi && values()[field.id]) {
                        <div class="ref-lookup-selected">
                          {{ lookupDisplayFor(field, values()[field.id]) }}
                          <button type="button" class="ref-lookup-clear" (click)="setValue(field, null)">✕</button>
                        </div>
                      }
                    </div>
                  }
                  @default {
                    <input [type]="field.type || 'text'" [name]="field.id" [placeholder]="field.placeholder || ''"
                           [value]="values()[field.id] ?? ''"
                           (input)="setValue(field, $any($event.target).value)" />
                  }
                }
              </div>
            }
          </div>
          <div class="ref-actions">
            <button type="submit" class="ref-submit">{{ f.submitLabel || 'Zapisz' }}</button>
          </div>
        </form>
      } @else {
        <div class="ref-missing">
          Formularz <code>{{ formId }}</code> nie znaleziony w DraftFormStore.
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .form-ref { background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #1f2937); border-radius: 6px; padding: 16px; }
    .ref-header { display: flex; align-items: baseline; gap: 10px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--ech-border, #1f2937); }
    .ref-title { font-size: 15px; font-weight: 700; color: var(--ech-fg, #e5e7eb); }
    .ref-id { font-size: 10px; color: var(--ech-muted, #9ca3af); font-family: var(--ech-font-mono); background: var(--ech-panel-alt); padding: 1px 6px; border-radius: 2px; }
    .ref-desc { font-size: 11px; color: var(--ech-muted, #6b7280); }

    .ref-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 10px; }
    .ref-cell { display: flex; flex-direction: column; gap: 4px; }
    .ref-label { font-size: 11px; color: var(--ech-muted, #9ca3af); font-weight: 600; }
    .ref-label .req { color: var(--ech-danger); margin-left: 2px; }
    .ref-form input, .ref-form select, .ref-form textarea { padding: 7px 10px; background: var(--ech-panel-alt, #1f2937); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: 3px; font-size: 13px; font-family: inherit; }
    .ref-form input:focus, .ref-form select:focus, .ref-form textarea:focus { border-color: var(--ech-accent); outline: none; }
    .ref-form textarea { min-height: 60px; resize: vertical; }
    .ref-form input[type=checkbox] { width: 16px; height: 16px; }

    .ref-actions { display: flex; justify-content: flex-end; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--ech-border, #1f2937); }
    .ref-submit { padding: 8px 20px; background: color-mix(in srgb, var(--ech-accent) 25%, var(--ech-panel)); border: 1px solid var(--ech-accent); color: var(--ech-info); border-radius: 3px; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600; }
    .ref-submit:hover { background: color-mix(in srgb, var(--ech-accent) 40%, var(--ech-panel)); }

    .ref-lookup { position: relative; }
    .ref-lookup-search { width: 100%; }
    .ref-lookup-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 50; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-accent, #58a6ff); border-top: none; border-radius: 0 0 3px 3px; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .ref-lookup-option { padding: 8px 12px; cursor: pointer; font-size: 12px; color: var(--ech-fg, #e5e7eb); }
    .ref-lookup-option:hover { background: color-mix(in srgb, var(--ech-accent, #58a6ff) 15%, transparent); }
    .ref-lookup-empty { padding: 12px; text-align: center; color: var(--ech-muted, #9ca3af); font-size: 12px; font-style: italic; }
    .ref-lookup-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .ref-lookup-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: var(--ech-accent, #58a6ff); color: var(--ech-bg, #0b1120); border-radius: 12px; font-size: 11px; font-weight: 600; }
    .ref-lookup-chip button { background: transparent; border: none; color: inherit; cursor: pointer; font-size: 10px; padding: 0 2px; opacity: 0.7; }
    .ref-lookup-chip button:hover { opacity: 1; }
    .ref-lookup-selected { display: flex; align-items: center; gap: 6px; margin-top: 4px; padding: 4px 8px; background: var(--ech-panel-alt, #1f2937); border: 1px solid var(--ech-accent, #58a6ff); border-radius: 3px; font-size: 12px; }
    .ref-lookup-clear { background: transparent; border: none; color: var(--ech-muted, #9ca3af); cursor: pointer; margin-left: auto; }

    .ref-missing { padding: 30px; text-align: center; color: var(--ech-muted, #9ca3af); font-size: 13px; }
    .ref-missing code { background: var(--ech-panel-alt); padding: 1px 6px; border-radius: 2px; color: var(--ech-danger); }
  `],
})
export class FormRefComponent {
  @Input() set formId(v: string) { this._formId.set(v ?? ''); }
  get formId(): string { return this._formId(); }
  private readonly _formId = signal('');

  @Output() readonly submit = new EventEmitter<Record<string, unknown>>();
  @Output() readonly change = new EventEmitter<Record<string, unknown>>();

  private readonly formStore = inject(DraftFormStoreService);
  private readonly modelStore = inject(DraftModelStoreService);
  private readonly dsStoreRef = inject(DraftDatasourceStoreService);
  private readonly dataContext = inject(DataContextService);
  private readonly dataBus = inject(DATA_BUS, { optional: true }) as DataBus | null;
  readonly values = signal<Record<string, unknown>>({});
  readonly lookupQueries = signal<Record<string, string>>({});
  readonly lookupOpen = signal<Record<string, boolean>>({});
  readonly lookupResults = signal<Record<string, ReadonlyArray<{ value: unknown; display: string }>>>({});
  readonly lookupSelected = signal<Record<string, Array<{ value: unknown; display: string }>>>({});

  readonly form = computed<DraftForm | null>(() => {
    const id = this._formId();
    if (!id) return null;
    return this.formStore.get(id);
  });

  constructor() {
    effect(() => {
      const f = this.form();
      if (!f) return;
      this.applyInputBindings(f);
    });
  }

  private applyInputBindings(form: DraftForm): void {
    if (!this.dataBus || !form.inputContracts) return;
    for (const contract of form.inputContracts) {
      try {
        const ds = this.dataBus.source(contract.datasourceId as never);
        const snapshot = ds.snapshot();
        if (!snapshot.value || typeof snapshot.value !== 'object') continue;
        const data = snapshot.value as Record<string, unknown>;
        for (const field of form.fields) {
          if (!field.inputBindings) continue;
          const alias = contract.alias ?? contract.datasourceId;
          for (const binding of field.inputBindings) {
            if (binding.source !== alias && binding.source !== contract.datasourceId) continue;
            const value = this.walkPath(data, binding.path);
            if (value === undefined) continue;
            switch (binding.effect) {
              case 'initialValue':
                this.values.update((v) => v[field.id] !== undefined ? v : { ...v, [field.id]: value });
                break;
              case 'options':
                break;
              case 'disabled':
              case 'readOnly':
              case 'visible':
                break;
              case 'label':
              case 'placeholder':
                break;
            }
          }
        }
      } catch { /* ds not available */ }
    }
  }

  private walkPath(obj: unknown, path: string): unknown {
    let cur = obj;
    for (const key of path.split('.')) {
      if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[key];
    }
    return cur;
  }

  setValue(field: DraftFormField, value: unknown): void {
    this.values.update((v) => ({ ...v, [field.id]: value }));
    this.change.emit(this.values());
  }

  onSubmit(e: Event): void {
    e.preventDefault();
    const form = this.form();
    if (!form) return;
    const payload = this.buildOutputPayload(form);
    this.submit.emit(payload);
  }

  private buildOutputPayload(form: DraftForm): Record<string, unknown> {
    const raw = this.values();
    if (!form.outputModel) return raw;
    const model = this.modelStore.get(form.outputModel);
    if (!model) return raw;

    const intent = form.intent ?? 'create';
    const policies = form.fieldPolicies ?? [];
    const out: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(raw)) {
      const mf = model.fields.find((f) => f.id === key);
      if (mf) {
        const behavior = resolveFieldBehavior(mf, intent, policies.find((p) => p.fieldId === key));
        if (!behavior.include) continue;
        if (behavior.readOnly && intent === 'create') continue;
      }
      out[key] = value;
    }
    return out;
  }

  // ─── Lookup ───

  onLookupSearch(field: DraftFormField, query: string): void {
    this.lookupQueries.update((q) => ({ ...q, [field.id]: query }));
    if (!field.lookupConfig) return;
    const cfg = field.lookupConfig;

    const items = this.resolveLookupItems(cfg);
    const searchField = cfg.searchField ?? cfg.displayFields[0] ?? 'id';
    const q = query.toLowerCase();
    const filtered = q.length > 0
      ? items.filter((item) => String(item[searchField] ?? '').toLowerCase().includes(q))
      : items;

    const results = filtered.slice(0, cfg.maxResults ?? 20).map((item) => ({
      value: item[cfg.valueField],
      display: cfg.displayFields.map((f) => String(item[f] ?? '')).filter(Boolean).join(' · '),
    }));
    this.lookupResults.update((r) => ({ ...r, [field.id]: results }));
  }

  private resolveLookupItems(cfg: NonNullable<DraftFormField['lookupConfig']>): ReadonlyArray<Record<string, unknown>> {
    // 1. Try sourceDatasource (explicit)
    if (cfg.sourceDatasource && this.dataBus) {
      try {
        const ds = this.dataBus.source(cfg.sourceDatasource as never);
        const snap = ds.snapshot();
        if (Array.isArray(snap.value)) return snap.value as Record<string, unknown>[];
        if (snap.value && typeof snap.value === 'object' && 'items' in (snap.value as object)) {
          return (snap.value as { items: unknown[] }).items as Record<string, unknown>[];
        }
      } catch { /* ds not available */ }
    }

    // 2. Try find DS by outputModel match
    for (const dsDraft of this.dsStoreRef.all()) {
      if (dsDraft.contract?.outputModel === cfg.sourceModel) {
        if (this.dataBus) {
          try {
            const ds = this.dataBus.source(dsDraft.id as never);
            const snap = ds.snapshot();
            if (Array.isArray(snap.value)) return snap.value as Record<string, unknown>[];
          } catch { /* skip */ }
        }
      }
    }

    // 3. Fallback: mock data from model
    const model = this.modelStore.get(cfg.sourceModel);
    if (model) return this.generateMockLookupData(model.fields, cfg, 20);
    return [];
  }

  openLookup(fieldId: string): void {
    this.lookupOpen.update((o) => ({ ...o, [fieldId]: true }));
  }

  closeLookupDelayed(fieldId: string): void {
    setTimeout(() => this.lookupOpen.update((o) => ({ ...o, [fieldId]: false })), 200);
  }

  selectLookup(field: DraftFormField, item: { value: unknown; display: string }): void {
    if (field.lookupConfig?.multi) {
      this.lookupSelected.update((s) => {
        const cur = [...(s[field.id] ?? [])];
        if (!cur.find((x) => x.value === item.value)) cur.push(item);
        return { ...s, [field.id]: cur };
      });
      this.setValue(field, this.lookupSelected()[field.id]?.map((s) => s.value) ?? []);
    } else {
      this.setValue(field, item.value);
    }
    this.lookupQueries.update((q) => ({ ...q, [field.id]: '' }));
  }

  removeLookupSelection(field: DraftFormField, value: unknown): void {
    this.lookupSelected.update((s) => {
      const cur = (s[field.id] ?? []).filter((x) => x.value !== value);
      return { ...s, [field.id]: cur };
    });
    this.setValue(field, this.lookupSelected()[field.id]?.map((s) => s.value) ?? []);
  }

  lookupDisplayFor(field: DraftFormField, value: unknown): string {
    const results = this.lookupResults()[field.id] ?? [];
    return results.find((r) => r.value === value)?.display ?? String(value);
  }

  private generateMockLookupData(modelFields: ReadonlyArray<{ id: string; type: string }>, cfg: DraftFormField['lookupConfig']  & {}, count: number): ReadonlyArray<Record<string, unknown>> {
    const items: Record<string, unknown>[] = [];
    for (let i = 1; i <= count; i++) {
      const item: Record<string, unknown> = {};
      for (const mf of modelFields) {
        switch (mf.type) {
          case 'string': item[mf.id] = `${mf.id}-${String(i).padStart(3, '0')}`; break;
          case 'number': item[mf.id] = i * 100; break;
          case 'boolean': item[mf.id] = i % 2 === 0; break;
          case 'date': item[mf.id] = `2026-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`; break;
          default: item[mf.id] = `${mf.id}-${i}`; break;
        }
      }
      items.push(item);
    }
    return items;
  }
}
