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

// ─── Schema types ───────────────────────────────────────────────────────────

export type PropertyType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date' | 'any';

export interface InputProperty {
  readonly type: PropertyType;
  readonly description?: string;
  readonly required?: boolean;
  /** Dla type:'object' — nested shape (max 1 level deep). */
  readonly properties?: Readonly<Record<string, InputPropertyLeaf>>;
  /** Dla type:'array' — typ elementu. */
  readonly itemType?: PropertyType;
  /** Dla type:'array' + itemType:'object' — shape elementu. */
  readonly itemProperties?: Readonly<Record<string, InputPropertyLeaf>>;
}

export type InputPropertyLeaf = Omit<InputProperty, 'properties' | 'itemProperties'>;

// ─── Input contract ─────────────────────────────────────────────────────────

export interface FormInputContract {
  /** ID datasource z którego dane przyjdą (np. 'clientData', 'spotPricing'). */
  readonly datasourceId: string;
  /** Alias wewnętrzny (np. 'client'). Domyślnie = datasourceId. */
  readonly alias?: string;
  /** Opis po co formularz potrzebuje tego datasource. */
  readonly description?: string;
  /** Oczekiwany kształt danych — property name → type + meta. */
  readonly schema: Readonly<Record<string, InputProperty>>;
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

// ─── Form field ─────────────────────────────────────────────────────────────

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
  readonly createdAt: number;
  readonly updatedAt: number;
}

// ─── Utilities ──────────────────────────────────────────────────────────────

export function syncRequiresFromContracts(form: DraftForm): DraftForm {
  if (!form.inputContracts || form.inputContracts.length === 0) return form;
  return { ...form, requires: form.inputContracts.map((c) => c.datasourceId) };
}

export interface ContractValidationError {
  readonly contractAlias: string;
  readonly datasourceId: string;
  readonly property: string;
  readonly expected: PropertyType;
  readonly actual: string;
  readonly message: string;
}

export function validateContractShape(
  contract: FormInputContract,
  snapshot: unknown,
): ReadonlyArray<ContractValidationError> {
  if (snapshot === undefined || snapshot === null) return [];
  if (typeof snapshot !== 'object' || Array.isArray(snapshot)) return [];
  const data = snapshot as Record<string, unknown>;
  const errors: ContractValidationError[] = [];
  const alias = contract.alias ?? contract.datasourceId;

  for (const [prop, spec] of Object.entries(contract.schema)) {
    const value = data[prop];
    if (spec.required && (value === undefined || value === null)) {
      errors.push({
        contractAlias: alias,
        datasourceId: contract.datasourceId,
        property: prop,
        expected: spec.type,
        actual: 'undefined',
        message: `Required property '${prop}' is missing`,
      });
      continue;
    }
    if (value === undefined || value === null) continue;
    if (spec.type !== 'any' && !typeMatches(value, spec.type)) {
      errors.push({
        contractAlias: alias,
        datasourceId: contract.datasourceId,
        property: prop,
        expected: spec.type,
        actual: typeof value,
        message: `Property '${prop}' expected ${spec.type}, got ${typeof value}`,
      });
    }
  }
  return errors;
}

function typeMatches(value: unknown, expected: PropertyType): boolean {
  switch (expected) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number';
    case 'boolean': return typeof value === 'boolean';
    case 'date': return typeof value === 'string' || value instanceof Date;
    case 'object': return typeof value === 'object' && !Array.isArray(value);
    case 'array': return Array.isArray(value);
    case 'any': return true;
  }
}

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
