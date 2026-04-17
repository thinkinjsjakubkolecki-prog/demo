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
