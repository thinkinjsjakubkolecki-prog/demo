/**
 * fx-composite-field — uniwersalny renderer złożonych pól formularza.
 *
 * Obsługuje wszystkie typy pól: podstawowe, composite, rich content.
 * Używany wewnątrz form-ref jako renderer per-field.
 */
import {
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EchelonWidget } from '@echelon-framework/runtime';

@EchelonWidget({
  manifest: {
    type: 'composite-field',
    version: '1.0.0',
    category: 'data',
    description: 'Uniwersalny renderer złożonych pól formularza (money, date-range, address, file, repeater, etc.).',
    inputs: [
      { name: 'fieldType', type: 'string' },
      { name: 'value', type: 'unknown' },
      { name: 'config', type: 'object' },
      { name: 'label', type: 'string' },
      { name: 'placeholder', type: 'string' },
      { name: 'required', type: 'boolean' },
      { name: 'disabled', type: 'boolean' },
    ],
    outputs: [
      { name: 'valueChange', eventType: 'composite-field.change' },
    ],
    actions: [],
    capabilities: {},
    testability: { interactions: [], observables: ['value'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-composite-field',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="cf" data-testid="widget-composite-field" data-echelon-state="ready">
      @switch (fieldType) {

        @case ('money') {
          <div class="cf-money">
            <input type="number" step="0.01" class="cf-amount" [placeholder]="placeholder || '0.00'"
                   [disabled]="disabled" [value]="moneyAmount()"
                   (input)="setMoneyAmount($any($event.target).value)" />
            <select class="cf-currency" [disabled]="disabled" [value]="moneyCurrency()"
                    (change)="setMoneyCurrency($any($event.target).value)">
              @for (c of moneyConfig?.currencies ?? defaultCurrencies; track c) {
                <option [value]="c">{{ c }}</option>
              }
            </select>
          </div>
        }

        @case ('date-range') {
          <div class="cf-daterange">
            <label class="cf-sub"><span>{{ dateRangeConfig?.startLabel ?? 'Od' }}</span>
              <input type="date" [disabled]="disabled" [value]="rangeStart()"
                     (input)="setRangeStart($any($event.target).value)" /></label>
            <span class="cf-sep">—</span>
            <label class="cf-sub"><span>{{ dateRangeConfig?.endLabel ?? 'Do' }}</span>
              <input type="date" [disabled]="disabled" [value]="rangeEnd()"
                     (input)="setRangeEnd($any($event.target).value)" /></label>
          </div>
        }

        @case ('address') {
          <div class="cf-address">
            @for (f of addressConfig?.fields ?? defaultAddressFields; track f) {
              <input type="text" [placeholder]="addressLabel(f)" [disabled]="disabled"
                     [value]="addressPart(f)" (input)="setAddressPart(f, $any($event.target).value)"
                     [class]="'cf-addr-' + f" />
            }
          </div>
        }

        @case ('phone') {
          <div class="cf-phone">
            <select class="cf-phone-code" [disabled]="disabled" [value]="phoneCode()"
                    (change)="setPhoneCode($any($event.target).value)">
              @for (c of phoneConfig?.countryCodes ?? defaultPhoneCodes; track c.code) {
                <option [value]="c.prefix">{{ c.code }} {{ c.prefix }}</option>
              }
            </select>
            <input type="tel" class="cf-phone-num" [placeholder]="placeholder || '123 456 789'"
                   [disabled]="disabled" [value]="phoneNumber()"
                   (input)="setPhoneNumber($any($event.target).value)" />
          </div>
        }

        @case ('file') {
          <div class="cf-file">
            <div class="cf-dropzone" [class.has-files]="files().length > 0">
              <input type="file" class="cf-file-input" [accept]="fileConfig?.accept ?? '*'"
                     [multiple]="fileConfig?.multi ?? false" [disabled]="disabled"
                     (change)="onFileSelect($event)" />
              @if (files().length === 0) {
                <span class="cf-drop-text">📎 Przeciągnij pliki lub kliknij</span>
              }
              @for (f of files(); track f.name) {
                <div class="cf-file-item">
                  <span class="cf-file-name">{{ f.name }}</span>
                  <span class="cf-file-size">{{ formatSize(f.size) }}</span>
                  <button type="button" class="cf-file-rm" (click)="removeFile(f.name)">✕</button>
                </div>
              }
            </div>
          </div>
        }

        @case ('range') {
          <div class="cf-range">
            <input type="range" [min]="rangeConfig?.min ?? 0" [max]="rangeConfig?.max ?? 100"
                   [step]="rangeConfig?.step ?? 1" [disabled]="disabled"
                   [value]="currentValue() ?? rangeConfig?.min ?? 0"
                   (input)="emit(+$any($event.target).value)" />
            @if (rangeConfig?.showValue !== false) {
              <span class="cf-range-val">{{ currentValue() ?? 0 }}{{ rangeConfig?.unit ? ' ' + rangeConfig.unit : '' }}</span>
            }
          </div>
        }

        @case ('rating') {
          <div class="cf-rating">
            @for (i of ratingStars(); track i) {
              <button type="button" class="cf-star" [class.active]="i <= (currentValue() ?? 0)"
                      [disabled]="disabled" (click)="emit(i)">
                {{ ratingConfig?.icon === 'heart' ? '♥' : ratingConfig?.icon === 'circle' ? '●' : '★' }}
              </button>
            }
          </div>
        }

        @case ('toggle') {
          <div class="cf-toggle" [class.on]="!!currentValue()" [class.disabled]="disabled"
               (click)="!disabled && emit(!currentValue())">
            <div class="cf-toggle-track"><div class="cf-toggle-thumb"></div></div>
            <span class="cf-toggle-label">{{ !!currentValue() ? 'On' : 'Off' }}</span>
          </div>
        }

        @case ('color') {
          <div class="cf-color">
            <input type="color" [value]="currentValue() ?? '#3b82f6'" [disabled]="disabled"
                   (input)="emit($any($event.target).value)" />
            <code class="cf-color-val">{{ currentValue() ?? '#3b82f6' }}</code>
          </div>
        }

        @case ('time') {
          <input type="time" [value]="currentValue() ?? ''" [disabled]="disabled"
                 [placeholder]="placeholder" (input)="emit($any($event.target).value)" />
        }

        @case ('rich-text') {
          <div class="cf-richtext">
            <div class="cf-rt-toolbar">
              <button type="button" (click)="rtAction('bold')"><b>B</b></button>
              <button type="button" (click)="rtAction('italic')"><i>I</i></button>
              <button type="button" (click)="rtAction('underline')"><u>U</u></button>
            </div>
            <div class="cf-rt-editor" contenteditable="true" [attr.data-placeholder]="placeholder || 'Wpisz tekst...'"
                 (input)="emit($any($event.target).innerHTML)"></div>
          </div>
        }

        @case ('code') {
          <textarea class="cf-code" [value]="currentValue() ?? ''" [disabled]="disabled"
                    [placeholder]="placeholder || '// wpisz kod'"
                    (input)="emit($any($event.target).value)" rows="8" spellcheck="false"></textarea>
        }

        @case ('json') {
          <textarea class="cf-code cf-json" [value]="currentValue() ?? '{}'" [disabled]="disabled"
                    [placeholder]="placeholder || '{}'"
                    [class.invalid]="!isValidJson()"
                    (input)="emit($any($event.target).value)" rows="8" spellcheck="false"></textarea>
        }

        @case ('signature') {
          <div class="cf-signature">
            <canvas class="cf-sig-canvas" [width]="signatureConfig?.width ?? 400" [height]="signatureConfig?.height ?? 150"></canvas>
            <div class="cf-sig-actions">
              <button type="button" class="cf-sig-clear" (click)="clearSignature()">Wyczyść</button>
            </div>
          </div>
        }

        @case ('key-value') {
          <div class="cf-kv">
            @for (entry of kvEntries(); track $index; let ki = $index) {
              <div class="cf-kv-row">
                <input type="text" class="cf-kv-key" [value]="entry.key" [placeholder]="kvConfig?.keyPlaceholder ?? 'klucz'"
                       (input)="setKvKey(ki, $any($event.target).value)" />
                <input type="text" class="cf-kv-val" [value]="entry.value" [placeholder]="kvConfig?.valuePlaceholder ?? 'wartość'"
                       (input)="setKvValue(ki, $any($event.target).value)" />
                <button type="button" class="cf-kv-rm" (click)="removeKvEntry(ki)">✕</button>
              </div>
            }
            <button type="button" class="cf-kv-add" [disabled]="disabled" (click)="addKvEntry()">+ Dodaj wpis</button>
          </div>
        }

        @case ('repeater') {
          <div class="cf-repeater">
            @for (item of repeaterItems(); track $index; let ri = $index) {
              <div class="cf-rep-item">
                <span class="cf-rep-num">{{ ri + 1 }}.</span>
                <div class="cf-rep-fields">
                  @for (sf of repeaterConfig?.itemFields ?? []; track sf.id) {
                    <div class="cf-rep-field">
                      <span class="cf-rep-label">{{ sf.label ?? sf.id }}</span>
                      <input type="text" [value]="item[sf.id] ?? ''" [placeholder]="sf.placeholder ?? ''"
                             (input)="setRepeaterValue(ri, sf.id, $any($event.target).value)" />
                    </div>
                  }
                </div>
                <button type="button" class="cf-rep-rm" (click)="removeRepeaterItem(ri)">✕</button>
              </div>
            }
            <button type="button" class="cf-rep-add" [disabled]="disabled" (click)="addRepeaterItem()">
              {{ repeaterConfig?.addLabel ?? '+ Dodaj' }}
            </button>
          </div>
        }

        @case ('inline-table') {
          <div class="cf-itable">
            <div class="cf-it-header">
              @for (col of inlineTableConfig?.columns ?? []; track col.id) {
                <span [style.flex]="col.width ?? 1">{{ col.label }}</span>
              }
              <span class="cf-it-act"></span>
            </div>
            @for (row of tableRows(); track $index; let ri = $index) {
              <div class="cf-it-row">
                @for (col of inlineTableConfig?.columns ?? []; track col.id) {
                  <input [type]="col.type === 'number' ? 'number' : 'text'" [style.flex]="col.width ?? 1"
                         [value]="row[col.id] ?? ''" (input)="setTableCell(ri, col.id, $any($event.target).value)" />
                }
                <button type="button" class="cf-it-rm" (click)="removeTableRow(ri)">✕</button>
              </div>
            }
            <button type="button" class="cf-it-add" [disabled]="disabled" (click)="addTableRow()">
              {{ inlineTableConfig?.addLabel ?? '+ Wiersz' }}
            </button>
          </div>
        }

        @default {
          <input [type]="fieldType || 'text'" [value]="currentValue() ?? ''" [disabled]="disabled"
                 [placeholder]="placeholder" (input)="emit($any($event.target).value)" />
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .cf input, .cf select, .cf textarea { padding: 7px 10px; background: var(--ech-panel-alt, #1f2937); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: var(--ech-radius-sm, 3px); font-size: 13px; font-family: inherit; }
    .cf input:focus, .cf select:focus, .cf textarea:focus { border-color: var(--ech-accent, #58a6ff); outline: none; }

    .cf-money { display: flex; gap: 6px; }
    .cf-amount { flex: 1; text-align: right; font-family: var(--ech-font-mono); }
    .cf-currency { width: 70px; }

    .cf-daterange { display: flex; gap: 8px; align-items: flex-end; }
    .cf-sub { display: flex; flex-direction: column; gap: 3px; flex: 1; }
    .cf-sub span { font-size: 10px; color: var(--ech-muted, #9ca3af); }
    .cf-sep { color: var(--ech-muted, #6b7280); padding-bottom: 8px; }

    .cf-address { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .cf-addr-street { grid-column: 1 / -1; }

    .cf-phone { display: flex; gap: 6px; }
    .cf-phone-code { width: 90px; }
    .cf-phone-num { flex: 1; }

    .cf-file { }
    .cf-dropzone { position: relative; border: 2px dashed var(--ech-border, #374151); border-radius: var(--ech-radius, 6px); padding: 16px; text-align: center; min-height: 60px; }
    .cf-dropzone.has-files { text-align: left; }
    .cf-file-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .cf-drop-text { font-size: 12px; color: var(--ech-muted, #9ca3af); }
    .cf-file-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 12px; }
    .cf-file-name { color: var(--ech-fg, #e5e7eb); flex: 1; }
    .cf-file-size { color: var(--ech-muted, #9ca3af); font-size: 10px; }
    .cf-file-rm { background: transparent; border: none; color: var(--ech-danger); cursor: pointer; font-size: 12px; padding: 2px; }

    .cf-range { display: flex; align-items: center; gap: 10px; }
    .cf-range input[type=range] { flex: 1; accent-color: var(--ech-accent, #58a6ff); }
    .cf-range-val { font-family: var(--ech-font-mono); font-size: 13px; color: var(--ech-accent, #58a6ff); min-width: 50px; }

    .cf-rating { display: flex; gap: 4px; }
    .cf-star { background: transparent; border: none; font-size: 20px; color: var(--ech-border, #374151); cursor: pointer; padding: 2px; transition: color 0.1s; }
    .cf-star.active { color: var(--ech-warning); }
    .cf-star:hover { color: var(--ech-warning); }

    .cf-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .cf-toggle.disabled { opacity: 0.5; cursor: not-allowed; }
    .cf-toggle-track { width: 40px; height: 22px; border-radius: 11px; background: var(--ech-border, #374151); position: relative; transition: background 0.2s; }
    .cf-toggle.on .cf-toggle-track { background: var(--ech-accent, #58a6ff); }
    .cf-toggle-thumb { width: 18px; height: 18px; border-radius: 50%; background: var(--ech-fg, #e5e7eb); position: absolute; top: 2px; left: 2px; transition: left 0.2s; }
    .cf-toggle.on .cf-toggle-thumb { left: 20px; }
    .cf-toggle-label { font-size: 12px; color: var(--ech-muted, #9ca3af); }

    .cf-color { display: flex; align-items: center; gap: 8px; }
    .cf-color input[type=color] { width: 36px; height: 36px; border: 1px solid var(--ech-border, #374151); border-radius: 4px; cursor: pointer; padding: 2px; }
    .cf-color-val { font-size: 11px; color: var(--ech-muted, #9ca3af); }

    .cf-richtext { border: 1px solid var(--ech-border, #374151); border-radius: var(--ech-radius-sm, 3px); overflow: hidden; }
    .cf-rt-toolbar { display: flex; gap: 2px; padding: 4px; background: var(--ech-panel, #0f172a); border-bottom: 1px solid var(--ech-border, #374151); }
    .cf-rt-toolbar button { background: transparent; border: 1px solid transparent; color: var(--ech-fg, #e5e7eb); padding: 4px 8px; border-radius: 2px; cursor: pointer; font-size: 12px; }
    .cf-rt-toolbar button:hover { background: var(--ech-panel-alt, #1f2937); }
    .cf-rt-editor { min-height: 100px; padding: 10px; background: var(--ech-panel-alt, #1f2937); color: var(--ech-fg, #e5e7eb); font-size: 13px; line-height: 1.5; outline: none; }
    .cf-rt-editor:empty::before { content: attr(data-placeholder); color: var(--ech-muted, #6b7280); }

    .cf-code { width: 100%; font-family: var(--ech-font-mono); font-size: 12px; resize: vertical; line-height: 1.5; tab-size: 2; }
    .cf-json.invalid { border-color: var(--ech-danger); }

    .cf-signature { }
    .cf-sig-canvas { border: 1px solid var(--ech-border, #374151); border-radius: var(--ech-radius-sm, 3px); background: var(--ech-panel-alt, #1f2937); cursor: crosshair; display: block; }
    .cf-sig-actions { margin-top: 4px; }
    .cf-sig-clear { padding: 3px 10px; background: transparent; border: 1px solid var(--ech-border, #374151); color: var(--ech-muted, #9ca3af); border-radius: 2px; font-size: 10px; cursor: pointer; }

    .cf-repeater { display: flex; flex-direction: column; gap: 6px; }
    .cf-rep-item { display: flex; gap: 6px; align-items: flex-start; padding: 8px; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); border-radius: var(--ech-radius-sm, 3px); }
    .cf-rep-num { font-size: 11px; color: var(--ech-muted, #6b7280); padding-top: 8px; min-width: 20px; }
    .cf-rep-fields { flex: 1; display: flex; flex-wrap: wrap; gap: 6px; }
    .cf-rep-field { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 120px; }
    .cf-rep-label { font-size: 10px; color: var(--ech-muted, #9ca3af); }
    .cf-rep-rm { background: transparent; border: 1px solid #7f1d1d44; color: var(--ech-danger); width: 22px; height: 22px; border-radius: 2px; cursor: pointer; font-size: 10px; margin-top: 6px; }
    .cf-kv { display: flex; flex-direction: column; gap: 4px; }
    .cf-kv-row { display: grid; grid-template-columns: 1fr 2fr 24px; gap: 4px; }
    .cf-kv-key, .cf-kv-val { padding: 6px 8px; background: var(--ech-panel-alt, #1f2937); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: var(--ech-radius-sm, 3px); font-size: 12px; font-family: var(--ech-font-mono); }
    .cf-kv-key { font-weight: 600; }
    .cf-kv-rm { background: transparent; border: 1px solid color-mix(in srgb, var(--ech-danger) 30%, transparent); color: var(--ech-danger); border-radius: 2px; cursor: pointer; font-size: 10px; }
    .cf-kv-add { padding: 5px 12px; background: transparent; border: 1px dashed var(--ech-border, #374151); color: var(--ech-muted, #9ca3af); border-radius: var(--ech-radius-sm, 3px); cursor: pointer; font-size: 11px; font-family: inherit; }
    .cf-kv-add:hover { border-color: var(--ech-accent); color: var(--ech-accent); }

    .cf-rep-add, .cf-it-add { padding: 6px 14px; background: var(--ech-panel-alt, #1f2937); border: 1px dashed var(--ech-border, #374151); color: var(--ech-muted, #9ca3af); border-radius: var(--ech-radius-sm, 3px); cursor: pointer; font-size: 12px; font-family: inherit; }
    .cf-rep-add:hover, .cf-it-add:hover { border-color: var(--ech-accent, #58a6ff); color: var(--ech-accent, #58a6ff); }

    .cf-itable { }
    .cf-it-header { display: flex; gap: 4px; padding: 6px 8px; background: var(--ech-panel, #0f172a); border-radius: var(--ech-radius-sm, 3px) var(--ech-radius-sm, 3px) 0 0; font-size: 10px; text-transform: uppercase; color: var(--ech-muted, #6b7280); font-weight: 600; }
    .cf-it-act { width: 24px; }
    .cf-it-row { display: flex; gap: 4px; padding: 3px; }
    .cf-it-row input { flex: 1; padding: 5px 8px; font-size: 12px; }
    .cf-it-rm { background: transparent; border: 1px solid #7f1d1d44; color: var(--ech-danger); width: 22px; height: 22px; border-radius: 2px; cursor: pointer; font-size: 10px; flex-shrink: 0; }
  `],
})
export class CompositeFieldComponent {
  @Input() fieldType = 'text';
  @Input() set value(v: unknown) { this._value.set(v); }
  @Input() config: Record<string, unknown> = {};
  @Input() label = '';
  @Input() placeholder = '';
  @Input() required = false;
  @Input() disabled = false;

  @Output() readonly valueChange = new EventEmitter<unknown>();

  private readonly _value = signal<unknown>(null);
  readonly currentValue = this._value.asReadonly;
  readonly files = signal<ReadonlyArray<{ name: string; size: number }>>([]);

  get moneyConfig() { return this.config as { currencies?: string[]; defaultCurrency?: string } | undefined; }
  get dateRangeConfig() { return this.config as { startLabel?: string; endLabel?: string } | undefined; }
  get addressConfig() { return this.config as { fields?: string[] } | undefined; }
  get phoneConfig() { return this.config as { countryCodes?: Array<{ code: string; prefix: string; name: string }>; defaultCountryCode?: string } | undefined; }
  get fileConfig() { return this.config as { accept?: string; multi?: boolean; maxSizeMb?: number } | undefined; }
  get rangeConfig() { return this.config as { min?: number; max?: number; step?: number; showValue?: boolean; unit?: string } | undefined; }
  get ratingConfig() { return this.config as { max?: number; icon?: string } | undefined; }
  get repeaterConfig() { return this.config as { itemFields?: Array<{ id: string; label?: string; placeholder?: string }>; addLabel?: string; maxItems?: number } | undefined; }
  get inlineTableConfig() { return this.config as { columns?: Array<{ id: string; label: string; type: string; width?: number }>; addLabel?: string; maxRows?: number } | undefined; }
  get signatureConfig() { return this.config as { width?: number; height?: number } | undefined; }

  readonly defaultCurrencies = ['PLN', 'USD', 'EUR', 'GBP', 'CHF'];
  readonly defaultAddressFields = ['street', 'city', 'zip', 'country'];
  readonly defaultPhoneCodes = [
    { code: 'PL', prefix: '+48', name: 'Polska' },
    { code: 'DE', prefix: '+49', name: 'Niemcy' },
    { code: 'GB', prefix: '+44', name: 'UK' },
    { code: 'US', prefix: '+1', name: 'USA' },
  ];

  ratingStars(): number[] {
    const max = this.ratingConfig?.max ?? 5;
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  emit(v: unknown): void { this._value.set(v); this.valueChange.emit(v); }

  // ─── Money ───
  moneyAmount(): string { const v = this._value() as { amount?: number } | null; return v?.amount !== undefined ? String(v.amount) : ''; }
  moneyCurrency(): string { const v = this._value() as { currency?: string } | null; return v?.currency ?? this.moneyConfig?.defaultCurrency ?? 'PLN'; }
  setMoneyAmount(val: string): void { this.emit({ amount: val ? +val : 0, currency: this.moneyCurrency() }); }
  setMoneyCurrency(c: string): void { this.emit({ amount: +(this.moneyAmount() || 0), currency: c }); }

  // ─── Date Range ───
  rangeStart(): string { return (this._value() as { start?: string } | null)?.start ?? ''; }
  rangeEnd(): string { return (this._value() as { end?: string } | null)?.end ?? ''; }
  setRangeStart(v: string): void { this.emit({ start: v, end: this.rangeEnd() }); }
  setRangeEnd(v: string): void { this.emit({ start: this.rangeStart(), end: v }); }

  // ─── Address ───
  addressPart(f: string): string { return (this._value() as Record<string, string> | null)?.[f] ?? ''; }
  setAddressPart(f: string, v: string): void { this.emit({ ...(this._value() as Record<string, string> ?? {}), [f]: v }); }
  addressLabel(f: string): string { return { street: 'Ulica', city: 'Miasto', zip: 'Kod', country: 'Kraj', state: 'Województwo' }[f] ?? f; }

  // ─── Phone ───
  phoneCode(): string { return (this._value() as { code?: string } | null)?.code ?? this.phoneConfig?.defaultCountryCode ?? '+48'; }
  phoneNumber(): string { return (this._value() as { number?: string } | null)?.number ?? ''; }
  setPhoneCode(c: string): void { this.emit({ code: c, number: this.phoneNumber() }); }
  setPhoneNumber(n: string): void { this.emit({ code: this.phoneCode(), number: n }); }

  // ─── File ───
  onFileSelect(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (!input.files) return;
    const newFiles = Array.from(input.files).map((f) => ({ name: f.name, size: f.size }));
    this.files.set([...this.files(), ...newFiles]);
    this.emit(this.files());
  }
  removeFile(name: string): void { this.files.update((f) => f.filter((x) => x.name !== name)); this.emit(this.files()); }
  formatSize(bytes: number): string { return bytes < 1024 ? `${bytes}B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)}KB` : `${(bytes / 1048576).toFixed(1)}MB`; }

  // ─── Rich Text ───
  rtAction(cmd: string): void { document.execCommand(cmd, false); }

  // ─── JSON ───
  isValidJson(): boolean { try { JSON.parse(String(this._value() ?? '{}')); return true; } catch { return false; } }

  // ─── Signature ───
  clearSignature(): void { this.emit(null); }

  // ─── Key-Value ───
  get kvConfig() { return this.config as { keyPlaceholder?: string; valuePlaceholder?: string; maxEntries?: number } | undefined; }
  kvEntries(): ReadonlyArray<{ key: string; value: string }> {
    const v = this._value();
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      return Object.entries(v as Record<string, unknown>).map(([k, val]) => ({ key: k, value: String(val ?? '') }));
    }
    return [];
  }
  addKvEntry(): void {
    const entries = this.kvEntries();
    const obj: Record<string, unknown> = {};
    for (const e of entries) obj[e.key] = e.value;
    obj[''] = '';
    this.emit(obj);
  }
  removeKvEntry(i: number): void {
    const entries = [...this.kvEntries()];
    entries.splice(i, 1);
    const obj: Record<string, unknown> = {};
    for (const e of entries) obj[e.key] = e.value;
    this.emit(obj);
  }
  setKvKey(i: number, newKey: string): void {
    const entries = [...this.kvEntries()];
    entries[i] = { ...entries[i], key: newKey };
    const obj: Record<string, unknown> = {};
    for (const e of entries) obj[e.key] = e.value;
    this.emit(obj);
  }
  setKvValue(i: number, newVal: string): void {
    const entries = [...this.kvEntries()];
    entries[i] = { ...entries[i], value: newVal };
    const obj: Record<string, unknown> = {};
    for (const e of entries) obj[e.key] = e.value;
    this.emit(obj);
  }

  // ─── Repeater ───
  repeaterItems(): ReadonlyArray<Record<string, unknown>> { return Array.isArray(this._value()) ? this._value() as Record<string, unknown>[] : []; }
  addRepeaterItem(): void { const items = [...this.repeaterItems(), {}]; this.emit(items); }
  removeRepeaterItem(i: number): void { const items = [...this.repeaterItems()]; items.splice(i, 1); this.emit(items); }
  setRepeaterValue(ri: number, key: string, val: unknown): void { const items = [...this.repeaterItems()]; items[ri] = { ...items[ri], [key]: val }; this.emit(items); }

  // ─── Inline Table ───
  tableRows(): ReadonlyArray<Record<string, unknown>> { return Array.isArray(this._value()) ? this._value() as Record<string, unknown>[] : []; }
  addTableRow(): void { this.emit([...this.tableRows(), {}]); }
  removeTableRow(i: number): void { const rows = [...this.tableRows()]; rows.splice(i, 1); this.emit(rows); }
  setTableCell(ri: number, col: string, val: unknown): void { const rows = [...this.tableRows()]; rows[ri] = { ...rows[ri], [col]: val }; this.emit(rows); }
}
