/**
 * fx-lookup-field — search + dropdown do wyboru encji z dużej listy.
 *
 * Use case: pole "Klient" w formularzu — tysiące rekordów, search z debounce,
 * preview wybranego, multi-select wariant.
 *
 * Standalone widget — używany wewnątrz form-ref lub samodzielnie.
 * Konfiguracja przez LookupFieldConfig (sourceModel, displayFields, valueField).
 */
import {
  EventEmitter,
  Input,
  Output,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EchelonWidget } from '@echelon-framework/runtime';
import { DraftModelStoreService, type ModelField } from './draft-model-store';

export interface LookupOption {
  readonly value: unknown;
  readonly display: string;
  readonly raw: Record<string, unknown>;
}

@EchelonWidget({
  manifest: {
    type: 'lookup-field',
    version: '1.0.0',
    category: 'data',
    description: 'Search + dropdown do wyboru encji z dużej listy (lookup/entity picker).',
    inputs: [
      { name: 'sourceModel', type: 'string' },
      { name: 'valueField', type: 'string' },
      { name: 'displayFields', type: 'string[]' },
      { name: 'searchField', type: 'string' },
      { name: 'items', type: 'object[]' },
      { name: 'value', type: 'unknown' },
      { name: 'multi', type: 'boolean' },
      { name: 'placeholder', type: 'string' },
      { name: 'label', type: 'string' },
      { name: 'required', type: 'boolean' },
      { name: 'disabled', type: 'boolean' },
      { name: 'minSearchLength', type: 'number' },
      { name: 'maxResults', type: 'number' },
    ],
    outputs: [
      { name: 'valueChange', eventType: 'lookup-field.change' },
      { name: 'search', eventType: 'lookup-field.search' },
    ],
    actions: [],
    capabilities: { dataBus: 'read', eventBus: 'emit' },
    testability: { interactions: [{ action: 'search' }, { action: 'select' }], observables: ['value'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-lookup-field',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="lookup" [class.open]="dropdownOpen()" [class.disabled]="disabled"
         data-testid="widget-lookup-field" data-echelon-state="ready">
      @if (label) { <label class="lf-label">{{ label }} @if (required) { <span class="req">*</span> } </label> }

      <div class="lf-input-wrap">
        @if (!multi) {
          @if (selectedDisplay()) {
            <div class="lf-selected" (click)="!disabled && clearSelection()">
              <span class="lf-selected-text">{{ selectedDisplay() }}</span>
              <span class="lf-clear" title="Wyczyść">✕</span>
            </div>
          } @else {
            <input type="text" class="lf-search" [placeholder]="placeholder || 'Szukaj...'"
                   [disabled]="disabled"
                   [ngModel]="query()" (ngModelChange)="onSearch($event)"
                   (focus)="onFocus()" (blur)="onBlur()" />
          }
        } @else {
          <div class="lf-multi-wrap">
            @for (sel of selectedMulti(); track sel.value) {
              <span class="lf-chip">
                {{ sel.display }}
                <button type="button" class="lf-chip-rm" (click)="removeMulti(sel.value)">✕</button>
              </span>
            }
            <input type="text" class="lf-search multi" [placeholder]="selectedMulti().length > 0 ? '' : (placeholder || 'Szukaj...')"
                   [disabled]="disabled"
                   [ngModel]="query()" (ngModelChange)="onSearch($event)"
                   (focus)="onFocus()" (blur)="onBlur()" />
          </div>
        }

        @if (loading()) {
          <span class="lf-spinner"></span>
        }
      </div>

      @if (dropdownOpen() && filteredOptions().length > 0) {
        <div class="lf-dropdown">
          @for (opt of filteredOptions(); track opt.value; let i = $index) {
            <div class="lf-option" [class.highlighted]="highlightedIndex() === i"
                 (mousedown)="selectOption(opt)" (mouseenter)="highlightedIndex.set(i)">
              <span class="lf-opt-display">{{ opt.display }}</span>
              @if (isSelected(opt)) { <span class="lf-opt-check">✓</span> }
            </div>
          }
        </div>
      }

      @if (dropdownOpen() && filteredOptions().length === 0 && query().length >= minSearchLengthValue) {
        <div class="lf-dropdown">
          <div class="lf-no-results">Brak wyników dla "{{ query() }}"</div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .lookup { position: relative; }
    .lookup.disabled { opacity: 0.5; pointer-events: none; }
    .lf-label { display: block; font-size: 11px; color: var(--ech-muted, #9ca3af); font-weight: 600; margin-bottom: 4px; }
    .lf-label .req { color: #ef4444; margin-left: 2px; }

    .lf-input-wrap { position: relative; }
    .lf-search { width: 100%; padding: 8px 10px; background: var(--ech-panel-alt, #1f2937); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: var(--ech-radius-sm, 3px); font-size: 13px; font-family: inherit; }
    .lf-search:focus { border-color: var(--ech-accent, #58a6ff); outline: none; }
    .lf-search.multi { border: none; padding: 4px 6px; background: transparent; flex: 1; min-width: 80px; }

    .lf-selected { display: flex; align-items: center; padding: 8px 10px; background: var(--ech-panel-alt, #1f2937); border: 1px solid var(--ech-accent, #58a6ff); border-radius: var(--ech-radius-sm, 3px); cursor: pointer; }
    .lf-selected-text { flex: 1; font-size: 13px; color: var(--ech-fg, #e5e7eb); }
    .lf-clear { color: var(--ech-muted, #9ca3af); font-size: 12px; }
    .lf-clear:hover { color: #ef4444; }

    .lf-multi-wrap { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px 6px; background: var(--ech-panel-alt, #1f2937); border: 1px solid var(--ech-border, #374151); border-radius: var(--ech-radius-sm, 3px); min-height: 36px; align-items: center; }
    .lf-multi-wrap:focus-within { border-color: var(--ech-accent, #58a6ff); }
    .lf-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: var(--ech-accent, #58a6ff); color: var(--ech-bg, #0b1120); border-radius: 12px; font-size: 11px; font-weight: 600; }
    .lf-chip-rm { background: transparent; border: none; color: inherit; cursor: pointer; font-size: 10px; padding: 0 2px; opacity: 0.7; }
    .lf-chip-rm:hover { opacity: 1; }

    .lf-spinner { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; border: 2px solid var(--ech-border, #374151); border-top-color: var(--ech-accent, #58a6ff); border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }

    .lf-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 50; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-accent, #58a6ff); border-top: none; border-radius: 0 0 var(--ech-radius-sm, 3px) var(--ech-radius-sm, 3px); max-height: 240px; overflow-y: auto; box-shadow: var(--ech-shadow, 0 4px 12px rgba(0,0,0,0.3)); }
    .lf-option { display: flex; align-items: center; padding: 8px 12px; cursor: pointer; font-size: 12px; color: var(--ech-fg, #e5e7eb); transition: background 0.1s; }
    .lf-option:hover, .lf-option.highlighted { background: color-mix(in srgb, var(--ech-accent, #58a6ff) 15%, transparent); }
    .lf-opt-display { flex: 1; }
    .lf-opt-check { color: var(--ech-accent, #58a6ff); font-weight: 700; }
    .lf-no-results { padding: 12px; text-align: center; color: var(--ech-muted, #9ca3af); font-size: 12px; font-style: italic; }
  `],
})
export class LookupFieldComponent {
  @Input() sourceModel = '';
  @Input() valueField = 'id';
  @Input() displayFields: ReadonlyArray<string> = ['name'];
  @Input() searchField = '';
  @Input() set items(v: ReadonlyArray<Record<string, unknown>> | null) { this._items.set(v ?? []); }
  @Input() set value(v: unknown) { this._value.set(v); }
  @Input() multi = false;
  @Input() placeholder = '';
  @Input() label = '';
  @Input() required = false;
  @Input() disabled = false;
  @Input() minSearchLength = 1;
  @Input() maxResults = 20;

  @Output() readonly valueChange = new EventEmitter<unknown>();
  @Output() readonly search = new EventEmitter<string>();

  private readonly modelStore = inject(DraftModelStoreService);

  private readonly _items = signal<ReadonlyArray<Record<string, unknown>>>([]);
  private readonly _value = signal<unknown>(null);
  readonly query = signal('');
  readonly dropdownOpen = signal(false);
  readonly highlightedIndex = signal(0);
  readonly loading = signal(false);
  private _blurTimeout: ReturnType<typeof setTimeout> | null = null;

  get minSearchLengthValue(): number { return this.minSearchLength; }

  readonly allOptions = computed<ReadonlyArray<LookupOption>>(() => {
    return this._items().map((item) => ({
      value: item[this.valueField],
      display: this.displayFields.map((f) => String(item[f] ?? '')).filter(Boolean).join(' · '),
      raw: item,
    }));
  });

  readonly filteredOptions = computed<ReadonlyArray<LookupOption>>(() => {
    const q = this.query().toLowerCase().trim();
    let opts = this.allOptions();
    if (q.length >= this.minSearchLength) {
      opts = opts.filter((o) => o.display.toLowerCase().includes(q));
    }
    return opts.slice(0, this.maxResults);
  });

  readonly selectedDisplay = computed<string | null>(() => {
    if (this.multi) return null;
    const v = this._value();
    if (v === null || v === undefined) return null;
    const opt = this.allOptions().find((o) => o.value === v);
    return opt?.display ?? String(v);
  });

  readonly selectedMulti = computed<ReadonlyArray<LookupOption>>(() => {
    if (!this.multi) return [];
    const vals = Array.isArray(this._value()) ? this._value() as unknown[] : [];
    return vals.map((v) => {
      const opt = this.allOptions().find((o) => o.value === v);
      return opt ?? { value: v, display: String(v), raw: {} };
    });
  });

  onSearch(q: string): void {
    this.query.set(q);
    this.highlightedIndex.set(0);
    if (q.length >= this.minSearchLength) {
      this.dropdownOpen.set(true);
      this.search.emit(q);
    } else {
      this.dropdownOpen.set(false);
    }
  }

  onFocus(): void {
    if (this._blurTimeout) { clearTimeout(this._blurTimeout); this._blurTimeout = null; }
    if (this.query().length >= this.minSearchLength || this.allOptions().length > 0) {
      this.dropdownOpen.set(true);
    }
  }

  onBlur(): void {
    this._blurTimeout = setTimeout(() => this.dropdownOpen.set(false), 200);
  }

  selectOption(opt: LookupOption): void {
    if (this.multi) {
      const current = Array.isArray(this._value()) ? [...this._value() as unknown[]] : [];
      if (current.includes(opt.value)) {
        const idx = current.indexOf(opt.value);
        current.splice(idx, 1);
      } else {
        current.push(opt.value);
      }
      this._value.set(current);
      this.valueChange.emit(current);
      this.query.set('');
    } else {
      this._value.set(opt.value);
      this.valueChange.emit(opt.value);
      this.query.set('');
      this.dropdownOpen.set(false);
    }
  }

  clearSelection(): void {
    this._value.set(this.multi ? [] : null);
    this.valueChange.emit(this.multi ? [] : null);
    this.query.set('');
  }

  removeMulti(val: unknown): void {
    const current = Array.isArray(this._value()) ? [...this._value() as unknown[]] : [];
    const idx = current.indexOf(val);
    if (idx >= 0) current.splice(idx, 1);
    this._value.set(current);
    this.valueChange.emit(current);
  }

  isSelected(opt: LookupOption): boolean {
    if (this.multi) {
      return Array.isArray(this._value()) && (this._value() as unknown[]).includes(opt.value);
    }
    return this._value() === opt.value;
  }
}
