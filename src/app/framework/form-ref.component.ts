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
  EventEmitter,
  inject,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EchelonWidget } from '@echelon-framework/runtime';
import { DraftFormStoreService, type DraftForm, type DraftFormField } from './designer-core';

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
    .form-ref { background: var(--panel, #0f172a); border: 1px solid var(--border, #1f2937); border-radius: 6px; padding: 16px; }
    .ref-header { display: flex; align-items: baseline; gap: 10px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border, #1f2937); }
    .ref-title { font-size: 15px; font-weight: 700; color: var(--fg, #e5e7eb); }
    .ref-id { font-size: 10px; color: var(--muted, #9ca3af); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #1f2937; padding: 1px 6px; border-radius: 2px; }
    .ref-desc { font-size: 11px; color: var(--muted, #6b7280); }

    .ref-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 10px; }
    .ref-cell { display: flex; flex-direction: column; gap: 4px; }
    .ref-label { font-size: 11px; color: var(--muted, #9ca3af); font-weight: 600; }
    .ref-label .req { color: #ef4444; margin-left: 2px; }
    .ref-form input, .ref-form select, .ref-form textarea { padding: 7px 10px; background: var(--panel-alt, #1f2937); border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 3px; font-size: 13px; font-family: inherit; }
    .ref-form input:focus, .ref-form select:focus, .ref-form textarea:focus { border-color: #3b82f6; outline: none; }
    .ref-form textarea { min-height: 60px; resize: vertical; }
    .ref-form input[type=checkbox] { width: 16px; height: 16px; }

    .ref-actions { display: flex; justify-content: flex-end; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border, #1f2937); }
    .ref-submit { padding: 8px 20px; background: #1e3a5f; border: 1px solid #3b82f6; color: #e0f2fe; border-radius: 3px; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600; }
    .ref-submit:hover { background: #1e40af; }

    .ref-missing { padding: 30px; text-align: center; color: var(--muted, #9ca3af); font-size: 13px; }
    .ref-missing code { background: #1f2937; padding: 1px 6px; border-radius: 2px; color: #fca5a5; }
  `],
})
export class FormRefComponent {
  @Input() set formId(v: string) { this._formId.set(v ?? ''); }
  get formId(): string { return this._formId(); }
  private readonly _formId = signal('');

  @Output() readonly submit = new EventEmitter<Record<string, unknown>>();
  @Output() readonly change = new EventEmitter<Record<string, unknown>>();

  private readonly formStore = inject(DraftFormStoreService);
  readonly values = signal<Record<string, unknown>>({});

  readonly form = computed<DraftForm | null>(() => {
    const id = this._formId();
    if (!id) return null;
    return this.formStore.get(id);
  });

  setValue(field: DraftFormField, value: unknown): void {
    this.values.update((v) => ({ ...v, [field.id]: value }));
    this.change.emit(this.values());
  }

  onSubmit(e: Event): void {
    e.preventDefault();
    this.submit.emit(this.values());
  }
}
