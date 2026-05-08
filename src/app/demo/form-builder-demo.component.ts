/**
 * Demo Form Builder — pokazuje renderowanie FormDefinition z 6 typami pól
 * + walidacja na blur i submit.
 */
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilderComponent } from '@echelon-framework/widgets-core';
import type { FormDefinition, FormValidationResult } from '@echelon-framework/designer-core';

const SAMPLE_FORM: FormDefinition = {
  id: 'demo-client-form',
  title: 'Edycja klienta',
  description: 'Demo Form Builder Sprint F3 — 6 typów podstawowych z walidacją.',
  intent: 'edit',
  showCancel: true,
  showReset: true,
  fields: [
    {
      id: 'name',
      type: 'text',
      label: 'Nazwa firmy',
      placeholder: 'np. Acme Sp. z o.o.',
      hint: 'Pełna nazwa zarejestrowana w KRS',
      required: true,
      width: 12,
      config: { kind: 'text', minLength: 3, maxLength: 120 },
      validators: [
        { id: 'min',  fnRef: 'minLength', args: { value: 3 },   message: 'Min. 3 znaki' },
        { id: 'max',  fnRef: 'maxLength', args: { value: 120 }, message: 'Max. 120 znaków' },
      ],
    },
    {
      id: 'email',
      type: 'email',
      label: 'E-mail kontaktowy',
      placeholder: 'biuro@firma.pl',
      required: true,
      width: 6,
      validators: [
        { id: 'em', fnRef: 'email', message: 'Nieprawidłowy email' },
      ],
    },
    {
      id: 'website',
      type: 'text',
      label: 'Strona WWW',
      placeholder: 'https://...',
      width: 6,
      config: { kind: 'text', prefix: 'https://' },
      validators: [
        { id: 'url', fnRef: 'url', message: 'Nieprawidłowy URL' },
      ],
    },
    {
      id: 'pin',
      type: 'password',
      label: 'PIN dostępu',
      placeholder: '••••••',
      width: 6,
      validators: [
        { id: 'len', fnRef: 'minLength', args: { value: 4 }, message: 'Min. 4 znaki' },
      ],
    },
    {
      id: 'employees',
      type: 'number',
      label: 'Liczba pracowników',
      width: 6,
      config: { kind: 'number', min: 1, max: 10000, step: 1, suffix: 'osób' },
      validators: [
        { id: 'min', fnRef: 'min', args: { value: 1 },     message: 'Min. 1' },
        { id: 'max', fnRef: 'max', args: { value: 10000 }, message: 'Max. 10000' },
      ],
    },
    {
      id: 'notes',
      type: 'textarea',
      label: 'Notatki wewnętrzne',
      placeholder: 'Dodatkowe informacje...',
      width: 12,
      config: { kind: 'text', rows: 4, maxLength: 500 },
    },
    {
      id: 'newsletter',
      type: 'boolean',
      label: 'Zgoda na newsletter (informacje o nowych produktach)',
      width: 12,
    },
    {
      id: 'priority',
      type: 'boolean',
      label: 'Klient priorytetowy',
      description: 'Klient z priorytetowym statusem otrzymuje szybszą obsługę.',
      width: 12,
    },
    // ─── Sprint F4 — choice ───
    {
      id: 'segment',
      type: 'select',
      label: 'Segment',
      width: 6,
      required: true,
      config: {
        kind: 'select',
        emptyLabel: '— wybierz segment —',
        options: [
          { value: 'corporate', label: 'Korporacyjny' },
          { value: 'retail',    label: 'Detaliczny' },
          { value: 'sme',       label: 'MSP' },
          { value: 'gov',       label: 'Sektor publiczny' },
        ],
      },
    },
    {
      id: 'industry',
      type: 'autocomplete',
      label: 'Branża',
      placeholder: 'Zacznij wpisywać...',
      width: 6,
      config: {
        kind: 'select',
        options: [
          { value: 'tech',     label: 'Technologie' },
          { value: 'finance',  label: 'Finanse' },
          { value: 'health',   label: 'Ochrona zdrowia' },
          { value: 'retail',   label: 'Handel detaliczny' },
          { value: 'energy',   label: 'Energetyka' },
          { value: 'agri',     label: 'Rolnictwo' },
          { value: 'manufact', label: 'Produkcja' },
        ],
      },
    },
    {
      id: 'preferredContact',
      type: 'radio',
      label: 'Preferowany kontakt',
      width: 12,
      config: {
        kind: 'select',
        options: [
          { value: 'email',  label: 'E-mail' },
          { value: 'phone',  label: 'Telefon' },
          { value: 'sms',    label: 'SMS' },
          { value: 'letter', label: 'Listownie' },
        ],
      },
    },
    {
      id: 'services',
      type: 'multi-select',
      label: 'Aktywne usługi',
      width: 12,
      config: {
        kind: 'select',
        options: [
          { value: 'fx-spot',     label: 'FX Spot' },
          { value: 'fx-forward',  label: 'FX Forward' },
          { value: 'fx-options',  label: 'FX Options' },
          { value: 'deposits',    label: 'Lokaty walutowe' },
          { value: 'transfers',   label: 'Przelewy międzynarodowe' },
        ],
      },
    },
    // ─── Sprint F4 — date/time ───
    {
      id: 'establishedDate',
      type: 'date',
      label: 'Data założenia',
      width: 4,
      config: { kind: 'date', max: new Date().toISOString().slice(0, 10) },
    },
    {
      id: 'lastContact',
      type: 'datetime',
      label: 'Ostatni kontakt',
      width: 4,
      config: { kind: 'noop' },
    },
    {
      id: 'preferredCallTime',
      type: 'time',
      label: 'Preferowana pora',
      width: 4,
      config: { kind: 'noop' },
    },
    {
      id: 'contractPeriod',
      type: 'date-range',
      label: 'Okres umowy',
      width: 12,
      config: { kind: 'date' },
    },
    // ─── Sprint F4 — primitives ───
    {
      id: 'phone',
      type: 'phone',
      label: 'Telefon',
      width: 6,
      validators: [
        { id: 'ph', fnRef: 'phone', message: 'Nieprawidłowy numer telefonu' },
      ],
    },
    {
      id: 'creditLimit',
      type: 'money',
      label: 'Limit kredytowy',
      width: 6,
      config: { kind: 'money', currency: 'PLN', precision: 2, min: 0, max: 10000000 },
    },
    {
      id: 'discount',
      type: 'percent',
      label: 'Rabat',
      width: 6,
      config: { kind: 'noop' },
    },
    {
      id: 'brandColor',
      type: 'color',
      label: 'Kolor brandu',
      width: 6,
      config: { kind: 'noop' },
    },
    // ─── Sprint F5 — composite ───
    {
      id: 'address',
      type: 'address',
      label: 'Adres siedziby',
      width: 12,
      config: { kind: 'address', fields: ['street', 'city', 'zip', 'country'] },
    },
    {
      id: 'tags',
      type: 'tags',
      label: 'Tagi (Enter dodaje)',
      width: 12,
      placeholder: 'np. VIP, Strategic',
      config: { kind: 'tags' },
    },
    {
      id: 'metadata',
      type: 'key-value',
      label: 'Metadane (klucz-wartość)',
      width: 12,
      config: { kind: 'key-value', keyLabel: 'Klucz', valueLabel: 'Wartość' },
    },
    {
      id: 'contacts',
      type: 'repeater',
      label: 'Osoby kontaktowe',
      width: 12,
      config: {
        kind: 'repeater',
        addLabel: '+ Dodaj kontakt',
        minItems: 0,
        maxItems: 5,
        childFields: [
          { id: 'name',  type: 'text',  label: 'Imię i nazwisko', width: 6, required: true },
          { id: 'role',  type: 'text',  label: 'Stanowisko',      width: 6 },
          { id: 'email', type: 'email', label: 'E-mail',          width: 6 },
          { id: 'phone', type: 'phone', label: 'Telefon',         width: 6 },
        ],
      },
    },
    {
      id: 'pricingTable',
      type: 'inline-table',
      label: 'Tabela rabatów',
      width: 12,
      config: {
        kind: 'inline-table',
        addRowLabel: '+ Wiersz',
        columns: [
          { id: 'product',  label: 'Produkt',  fieldType: 'text',    width: 200 },
          { id: 'qty',      label: 'Ilość',    fieldType: 'number',  width: 100 },
          { id: 'discount', label: 'Rabat %',  fieldType: 'number',  width: 100 },
          { id: 'active',   label: 'Aktywny',  fieldType: 'boolean', width: 80  },
        ],
      },
    },
    {
      id: 'shipping',
      type: 'object',
      label: 'Dane dostawy',
      width: 12,
      config: {
        kind: 'object',
        title: 'Adres dostawy (opcjonalnie)',
        fields: [
          { id: 'name',    type: 'text', label: 'Odbiorca',  width: 6 },
          { id: 'phone',   type: 'phone', label: 'Telefon',  width: 6 },
          { id: 'address', type: 'address', label: 'Adres',  width: 12, config: { kind: 'address', fields: ['street', 'city', 'zip', 'country'] } },
        ],
      },
    },
  ],
  submitLabel: 'Zapisz klienta',
  cancelLabel: 'Anuluj',
  resetLabel: 'Wyczyść',
};

@Component({
  selector: 'app-form-builder-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormBuilderComponent],
  template: `
    <div class="page">
      <header>
        <h1>📝 Form Builder Demo</h1>
        <p>Sprint F3 — runtime widget <code>&lt;ech-form-builder&gt;</code> renderujący <code>FormDefinition</code>.</p>
        <p>6 typów pól: text, email, password, textarea, number, boolean. Walidacja na blur i submit.</p>
      </header>

      <div class="grid">
        <div class="card">
          <h2>Live form</h2>
          <ech-form-builder
            [definition]="form"
            [value]="initialValue"
            mode="edit"
            (submit)="onSubmit($event)"
            (change)="onChange($event)"
            (fieldChange)="onFieldChange($event)"
            (cancel)="onCancel()"
            (validate)="onValidate($event)"
          />
        </div>

        <div class="card">
          <h2>Stan</h2>

          <strong>Aktualne wartości</strong>
          <pre>{{ valuesJson() }}</pre>

          <strong>Ostatnia walidacja</strong>
          <pre>{{ validationJson() }}</pre>

          <strong>Log eventów</strong>
          <pre>{{ logJson() }}</pre>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--ech-bg, #0b1120); color: var(--ech-fg, #e5e7eb); font-family: system-ui, sans-serif; }
    .page { max-width: 1400px; margin: 0 auto; padding: 24px; }
    h1 { color: #58a6ff; margin: 0 0 8px; }
    h2 { color: #58a6ff; font-size: 14px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    p { color: #9ca3af; line-height: 1.5; margin: 4px 0; }
    code { background: #1f2937; padding: 2px 6px; border-radius: 3px; font-family: ui-monospace, monospace; font-size: 11px; }
    .grid { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-top: 24px; }
    .card { background: #0f172a; border: 1px solid #1f2937; border-radius: 8px; padding: 20px; }
    strong { color: #58a6ff; font-size: 12px; display: block; margin: 12px 0 4px; }
    pre { background: #0b1120; border: 1px solid #1f2937; padding: 8px; border-radius: 4px; font-size: 11px; white-space: pre-wrap; max-height: 240px; overflow: auto; color: #c9d1d9; margin: 0; }
  `],
})
export class FormBuilderDemoComponent {
  readonly form: FormDefinition = SAMPLE_FORM;
  readonly initialValue: Record<string, unknown> = {
    name: 'Acme Sp. z o.o.',
    email: 'biuro@acme.pl',
    employees: 42,
    newsletter: true,
  };

  readonly currentValues = signal<Record<string, unknown>>(this.initialValue);
  readonly lastValidation = signal<FormValidationResult | null>(null);
  readonly log = signal<string[]>([]);

  onSubmit(event: { values: Record<string, unknown>; valid: boolean }): void {
    this.log.update((l) => [`✓ submit (valid=${event.valid}) ${new Date().toLocaleTimeString()}`, ...l].slice(0, 10));
  }

  onChange(values: Record<string, unknown>): void {
    this.currentValues.set(values);
  }

  onFieldChange(event: { fieldId: string; value: unknown }): void {
    this.log.update((l) => [`change: ${event.fieldId} = ${JSON.stringify(event.value)}`, ...l].slice(0, 10));
  }

  onCancel(): void {
    this.log.update((l) => [`cancel @ ${new Date().toLocaleTimeString()}`, ...l].slice(0, 10));
  }

  onValidate(result: FormValidationResult): void {
    this.lastValidation.set(result);
  }

  valuesJson(): string { return JSON.stringify(this.currentValues(), null, 2); }
  validationJson(): string {
    const v = this.lastValidation();
    if (!v) return '(brak)';
    return JSON.stringify({ valid: v.valid, errorsCount: v.errors.length, errorsByField: v.errorsByField }, null, 2);
  }
  logJson(): string {
    const l = this.log();
    return l.length === 0 ? '(brak)' : l.join('\n');
  }
}
