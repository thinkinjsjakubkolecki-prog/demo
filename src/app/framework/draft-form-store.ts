/**
 * DraftFormStore — persystentne drafty formularzy (niezależnych od stron).
 *
 * Formularz to self-contained, silnie izolowany artefakt:
 *  - deklaruje TYPED input contracts (czego potrzebuje + oczekiwany kształt danych)
 *  - deklaruje output events (co emituje)
 *  - ma pola z bindingami do input contracts (field ← input.path)
 *  - strona/proces go osadza i dostarcza dane — formularz waliduje kształt
 *
 * Architektura wzorowana na OutSystems Block Input Parameters:
 *  - formularz = block, inputContracts = typed input parameters
 *  - strona = consumer, walidacja shape compatibility w design-time
 *  - runtime: form-ref subskrybuje DataBus per contract, aplikuje bindingi na pola
 */
import { Injectable, signal, computed } from '@angular/core';
import type { PropertyType, SchemaProperty, Schema } from './schema-types';

export type { PropertyType, SchemaProperty as InputProperty, Schema };

// ─── Input contract ─────────────────────────────────────────────────────────

export interface FormInputContract {
  /** ID datasource z którego dane przyjdą (np. 'clientData', 'spotPricing'). */
  readonly datasourceId: string;
  /** Alias wewnętrzny (np. 'client'). Domyślnie = datasourceId. */
  readonly alias?: string;
  /** Opis po co formularz potrzebuje tego datasource. */
  readonly description?: string;
  /** Oczekiwany kształt danych — property name → type + meta. */
  readonly schema: Schema;
}

// ─── Field input binding ────────────────────────────────────────────────────

export type BindingEffect =
  | 'initialValue'
  | 'options'
  | 'disabled'
  | 'visible'
  | 'readOnly'
  | 'label'
  | 'placeholder';

export interface FieldInputBinding {
  /** Alias inputContract (lub datasourceId) z którego czytamy. */
  readonly source: string;
  /** Dot-path do wartości w datasource (np. 'name', 'accounts.0.iban'). */
  readonly path: string;
  /** Co binding robi z polem. */
  readonly effect: BindingEffect;
  /** Dla effect:'options' — klucz wartości w obiekcie-elemencie. */
  readonly optionValueKey?: string;
  /** Dla effect:'options' — klucz labelu w obiekcie-elemencie. */
  readonly optionLabelKey?: string;
}

// ─── Form intent + field policy ──────────────────────────────────────────────

export type FormIntent = 'create' | 'edit' | 'view' | 'filter' | 'patch';

export interface ModelFieldPolicy {
  readonly fieldId: string;
  /** Override: include/exclude this field from the form regardless of intent defaults. */
  readonly include?: boolean;
  /** Override: required state (null = inherit from intent default). */
  readonly required?: boolean | null;
  /** Override: readonly state. */
  readonly readOnly?: boolean;
  /** Override: default value for this specific form. */
  readonly defaultValue?: unknown;
}

export interface ResolvedFieldBehavior {
  readonly include: boolean;
  readonly required: boolean;
  readonly readOnly: boolean;
}

type ModelFieldLike = { required?: boolean; primaryKey?: boolean; serverManaged?: boolean };

const INTENT_DEFAULTS: Record<FormIntent, (mf: ModelFieldLike) => ResolvedFieldBehavior> = {
  create: (mf) => ({
    include: !mf.serverManaged,
    required: !!mf.required && !mf.serverManaged && !mf.primaryKey,
    readOnly: false,
  }),
  edit: (mf) => ({
    include: !mf.serverManaged || !!mf.primaryKey,
    required: !!mf.required,
    readOnly: !!mf.primaryKey || !!mf.serverManaged,
  }),
  view: () => ({
    include: true,
    required: false,
    readOnly: true,
  }),
  filter: (mf) => ({
    include: !mf.serverManaged,
    required: false,
    readOnly: false,
  }),
  patch: (mf) => ({
    include: !mf.serverManaged,
    required: false,
    readOnly: false,
  }),
};

export function resolveFieldBehavior(
  mf: ModelFieldLike,
  intent: FormIntent,
  policy?: ModelFieldPolicy,
): ResolvedFieldBehavior {
  const base = INTENT_DEFAULTS[intent](mf);
  if (!policy) return base;
  return {
    include: policy.include ?? base.include,
    required: policy.required ?? base.required,
    readOnly: policy.readOnly ?? base.readOnly,
  };
}

// ─── Form field ─────────────────────────────────────────────────────────────

export interface LookupFieldConfig {
  /** Model z którego szukamy (np. 'Client'). */
  readonly sourceModel: string;
  /** DS który obsługuje search query (np. 'clientSearch'). */
  readonly sourceDatasource?: string;
  /** Pole modelu zwracane jako wartość formularza (np. 'id'). */
  readonly valueField: string;
  /** Pola modelu wyświetlane w dropdown (np. ['name', 'code']). */
  readonly displayFields: ReadonlyArray<string>;
  /** Pole modelu po którym szukamy (np. 'name'). */
  readonly searchField?: string;
  /** Multi-select (np. tagi, przypisani userzy). Default: false. */
  readonly multi?: boolean;
  /** Min znaków zanim odpali search. Default: 1. */
  readonly minSearchLength?: number;
  /** Debounce ms. Default: 300. */
  readonly debounceMs?: number;
  /** Max wyników w dropdown. Default: 20. */
  readonly maxResults?: number;
}

// ─── Composite field configs ────────────────────────────────────────────────

export interface MoneyFieldConfig {
  readonly currencies: ReadonlyArray<string>;
  readonly defaultCurrency?: string;
  readonly precision?: number;
}

export interface DateRangeFieldConfig {
  readonly startLabel?: string;
  readonly endLabel?: string;
  readonly minDate?: string;
  readonly maxDate?: string;
}

export interface AddressFieldConfig {
  readonly fields: ReadonlyArray<'street' | 'city' | 'zip' | 'country' | 'state'>;
  readonly countries?: ReadonlyArray<{ code: string; name: string }>;
}

export interface PhoneFieldConfig {
  readonly defaultCountryCode?: string;
  readonly countryCodes?: ReadonlyArray<{ code: string; prefix: string; name: string }>;
}

export interface FileFieldConfig {
  readonly accept?: string;
  readonly maxSizeMb?: number;
  readonly maxFiles?: number;
  readonly multi?: boolean;
  readonly preview?: boolean;
}

export interface RangeFieldConfig {
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly showValue?: boolean;
  readonly unit?: string;
}

export interface RatingFieldConfig {
  readonly max: number;
  readonly icon?: 'star' | 'heart' | 'circle';
}

export interface RepeaterFieldConfig {
  readonly itemFields: ReadonlyArray<DraftFormField>;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly addLabel?: string;
}

export interface InlineTableFieldConfig {
  readonly columns: ReadonlyArray<{ id: string; label: string; type: string; width?: number }>;
  readonly minRows?: number;
  readonly maxRows?: number;
  readonly addLabel?: string;
}

export interface RichTextFieldConfig {
  readonly toolbar?: ReadonlyArray<'bold' | 'italic' | 'underline' | 'list' | 'link' | 'heading'>;
  readonly maxLength?: number;
}

export interface CodeFieldConfig {
  readonly language?: string;
  readonly lineNumbers?: boolean;
  readonly maxLines?: number;
}

export interface SignatureFieldConfig {
  readonly width?: number;
  readonly height?: number;
  readonly penColor?: string;
}

export interface DraftFormField {
  id: string;
  label?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  pattern?: string;
  options?: ReadonlyArray<{ value: string; label: string }>;
  width?: number;
  actions?: {
    onChange?: ReadonlyArray<Record<string, unknown>>;
    onBlur?: ReadonlyArray<Record<string, unknown>>;
    onFocus?: ReadonlyArray<Record<string, unknown>>;
  };
  /** Typed bindingi — pole czyta dane z input contracts. */
  inputBindings?: ReadonlyArray<FieldInputBinding>;
  /** Konfiguracja lookup — pole typu 'lookup' szuka w innym modelu. */
  lookupConfig?: LookupFieldConfig;
  /** Konfiguracja złożonych typów pól. */
  moneyConfig?: MoneyFieldConfig;
  dateRangeConfig?: DateRangeFieldConfig;
  addressConfig?: AddressFieldConfig;
  phoneConfig?: PhoneFieldConfig;
  fileConfig?: FileFieldConfig;
  rangeConfig?: RangeFieldConfig;
  ratingConfig?: RatingFieldConfig;
  repeaterConfig?: RepeaterFieldConfig;
  inlineTableConfig?: InlineTableFieldConfig;
  richTextConfig?: RichTextFieldConfig;
  codeConfig?: CodeFieldConfig;
  signatureConfig?: SignatureFieldConfig;
}

// ─── Draft form ─────────────────────────────────────────────────────────────

export interface DraftForm {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly fields: ReadonlyArray<DraftFormField>;
  readonly submitLabel?: string;
  /** @deprecated Używaj inputContracts. Zachowane dla backward compat. */
  readonly requires: ReadonlyArray<string>;
  readonly emits: ReadonlyArray<{ event: string; description?: string }>;
  /** Typed input contracts — autorytarywne źródło requires od Phase 1+. */
  readonly inputContracts?: ReadonlyArray<FormInputContract>;
  /** Intencja formularza — determinuje default include/required/readOnly per pole. */
  readonly intent?: FormIntent;
  /** Per-field overrides intent defaults. Tylko deviacje od intent default. */
  readonly fieldPolicies?: ReadonlyArray<ModelFieldPolicy>;
  /**
   * Output model — model danych który formularz PRODUKUJE.
   * Formularz = datasource kind:'form' z outputSchema = Model.
   * Strona może bindować $ds.{formId} jak każdy inny datasource.
   */
  readonly outputModel?: string;
  /**
   * Formularz jako datasource — rejestruje się w pipeline danych.
   * true = formularz jest widoczny w DS Designer jako kind:'form'.
   */
  readonly registerAsDatasource?: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

// ─── Utilities ──────────────────────────────────────────────────────────────

export function syncRequiresFromContracts(form: DraftForm): DraftForm {
  if (!form.inputContracts || form.inputContracts.length === 0) return form;
  return { ...form, requires: form.inputContracts.map((c) => c.datasourceId) };
}

export { validateSnapshotAgainstSchema, validateSchemaCompatibility } from './schema-types';

// ─── Store ──────────────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'dealer-fx:draft-form:';
const INDEX_KEY = 'dealer-fx:draft-form-index';

@Injectable({ providedIn: 'root' })
export class DraftFormStoreService {
  private readonly forms = signal<ReadonlyArray<DraftForm>>([]);
  readonly all = computed<ReadonlyArray<DraftForm>>(() => this.forms());

  constructor() {
    this.loadFromStorage();
  }

  get(id: string): DraftForm | null {
    return this.forms().find((f) => f.id === id) ?? null;
  }

  save(form: DraftForm): void {
    const now = Date.now();
    const synced = syncRequiresFromContracts(form);
    const withTs: DraftForm = { ...synced, updatedAt: now, createdAt: form.createdAt || now };
    this.writeToStorage(withTs);
    this.forms.update((list) => {
      const without = list.filter((f) => f.id !== form.id);
      return [...without, withTs];
    });
  }

  remove(id: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_PREFIX + id);
      this.updateIndex((ids) => ids.filter((x) => x !== id));
    }
    this.forms.update((list) => list.filter((f) => f.id !== id));
  }

  upsert(partial: Omit<DraftForm, 'createdAt' | 'updatedAt'>): void {
    const existing = this.get(partial.id);
    const now = Date.now();
    this.save({
      ...partial,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  updateFields(id: string, fields: ReadonlyArray<DraftFormField>): void {
    const existing = this.get(id);
    if (!existing) return;
    this.save({ ...existing, fields });
  }

  updateContracts(id: string, contracts: ReadonlyArray<FormInputContract>): void {
    const existing = this.get(id);
    if (!existing) return;
    this.save({ ...existing, inputContracts: contracts });
  }

  setOutputModel(id: string, modelId: string | undefined): void {
    const existing = this.get(id);
    if (!existing) return;
    this.save({ ...existing, outputModel: modelId, registerAsDatasource: !!modelId });
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(INDEX_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const loaded: DraftForm[] = [];
      for (const id of ids) {
        const r = window.localStorage.getItem(STORAGE_PREFIX + id);
        if (!r) continue;
        try {
          const parsed = JSON.parse(r) as DraftForm;
          if (parsed && parsed.id === id) loaded.push(parsed);
        } catch { /* skip corrupted */ }
      }
      this.forms.set(loaded);
    } catch { this.forms.set([]); }
  }

  private writeToStorage(form: DraftForm): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_PREFIX + form.id, JSON.stringify(form));
    this.updateIndex((ids) => ids.includes(form.id) ? ids : [...ids, form.id]);
  }

  private updateIndex(mutator: (ids: string[]) => string[]): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const current = window.localStorage.getItem(INDEX_KEY);
    const ids: string[] = current ? JSON.parse(current) : [];
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(mutator(ids)));
  }
}
