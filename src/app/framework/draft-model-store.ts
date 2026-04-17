/**
 * DraftModelStore — persystentne modele danych (izolowane byty).
 *
 * Model to deklaracja kształtu danych:
 *  - pola z typami, walidacjami, relacjami
 *  - PK (primary key), required, enum values
 *  - relacje do innych modeli (1:N, N:1, N:M)
 *
 * Referencje:
 *  - DS deklaruje outputSchema jako ref do modelu (lub array modelu)
 *  - Form deklaruje inputContract.schema jako ref do modelu
 *  - Zmiana modelu propaguje się do DS i form (single source of truth)
 *
 * Storage: localStorage z prefixem `dealer-fx:draft-model:`.
 */
import { Injectable, signal, computed } from '@angular/core';
import type { PropertyType } from './schema-types';

export interface ModelField {
  readonly id: string;
  readonly label?: string;
  readonly type: PropertyType;
  readonly required?: boolean;
  readonly primaryKey?: boolean;
  readonly unique?: boolean;
  readonly description?: string;
  /** Dla type:'string' — enum wartości (zamknięty zbiór). */
  readonly enumValues?: ReadonlyArray<string>;
  /** Dla type:'number' — min/max. */
  readonly min?: number;
  readonly max?: number;
  /** Dla type:'string' — regex pattern. */
  readonly pattern?: string;
  /** Dla type:'string' — min/max length. */
  readonly minLength?: number;
  readonly maxLength?: number;
  /** Relacja do innego modelu (foreign key). */
  readonly ref?: ModelRelation;
  /** Wartość domyślna. */
  readonly defaultValue?: unknown;
  /** Pole zarządzane przez serwer — auto-generowane, nie edytowalne przez usera (np. id, createdAt, version). */
  readonly serverManaged?: boolean;
  /** Dla type:'array' bez ref — typ elementu prymitywnego (string/number/boolean/date). */
  readonly itemType?: PropertyType;
}

export interface ModelRelation {
  /** ID modelu docelowego. */
  readonly modelId: string;
  /** Typ relacji. */
  readonly kind: '1:1' | '1:N' | 'N:1' | 'N:M';
  /** Pole w modelu docelowym (FK). Domyślnie = PK. */
  readonly foreignKey?: string;
}

export interface DraftModel {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly fields: ReadonlyArray<ModelField>;
  readonly createdAt: number;
  readonly updatedAt: number;
}

const STORAGE_PREFIX = 'dealer-fx:draft-model:';
const INDEX_KEY = 'dealer-fx:draft-model-index';

@Injectable({ providedIn: 'root' })
export class DraftModelStoreService {
  private readonly models = signal<ReadonlyArray<DraftModel>>([]);
  readonly all = computed<ReadonlyArray<DraftModel>>(() => this.models());

  constructor() {
    this.loadFromStorage();
  }

  get(id: string): DraftModel | null {
    return this.models().find((m) => m.id === id) ?? null;
  }

  save(model: DraftModel): void {
    const now = Date.now();
    const withTs: DraftModel = { ...model, updatedAt: now, createdAt: model.createdAt || now };
    this.writeToStorage(withTs);
    this.models.update((list) => {
      const without = list.filter((m) => m.id !== model.id);
      return [...without, withTs];
    });
  }

  remove(id: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_PREFIX + id);
      this.updateIndex((ids) => ids.filter((x) => x !== id));
    }
    this.models.update((list) => list.filter((m) => m.id !== id));
  }

  upsert(partial: Omit<DraftModel, 'createdAt' | 'updatedAt'>): void {
    const existing = this.get(partial.id);
    const now = Date.now();
    this.save({ ...partial, createdAt: existing?.createdAt ?? now, updatedAt: now });
  }

  updateFields(id: string, fields: ReadonlyArray<ModelField>): void {
    const existing = this.get(id);
    if (!existing) return;
    this.save({ ...existing, fields });
  }

  /**
   * Konwertuje model na Schema (flat property map) — do użycia jako
   * DS.outputSchema lub Form.inputContract.schema.
   */
  toSchema(id: string): Readonly<Record<string, { type: PropertyType; required?: boolean; description?: string }>> | null {
    const model = this.get(id);
    if (!model) return null;
    const out: Record<string, { type: PropertyType; required?: boolean; description?: string }> = {};
    for (const f of model.fields) {
      out[f.id] = {
        type: f.ref ? (f.ref.kind === '1:N' || f.ref.kind === 'N:M' ? 'array' : 'object') : f.type,
        ...(f.required ? { required: true } : {}),
        ...(f.description ? { description: f.description } : {}),
      };
    }
    return out;
  }

  /**
   * Znajduje wszystkie modele które referencjonują dany model (reverse relations).
   */
  findReferencingModels(modelId: string): ReadonlyArray<{ model: DraftModel; field: ModelField }> {
    const out: Array<{ model: DraftModel; field: ModelField }> = [];
    for (const m of this.models()) {
      for (const f of m.fields) {
        if (f.ref?.modelId === modelId) {
          out.push({ model: m, field: f });
        }
      }
    }
    return out;
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(INDEX_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const loaded: DraftModel[] = [];
      for (const id of ids) {
        const r = window.localStorage.getItem(STORAGE_PREFIX + id);
        if (!r) continue;
        try {
          const parsed = JSON.parse(r) as DraftModel;
          if (parsed && parsed.id === id) loaded.push(parsed);
        } catch { /* skip */ }
      }
      this.models.set(loaded);
    } catch { this.models.set([]); }
  }

  private writeToStorage(model: DraftModel): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_PREFIX + model.id, JSON.stringify(model));
    this.updateIndex((ids) => ids.includes(model.id) ? ids : [...ids, model.id]);
  }

  private updateIndex(mutator: (ids: string[]) => string[]): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const current = window.localStorage.getItem(INDEX_KEY);
    const ids: string[] = current ? JSON.parse(current) : [];
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(mutator(ids)));
  }
}
