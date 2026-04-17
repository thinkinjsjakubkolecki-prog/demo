/**
 * DraftFormStore — persystentne drafty formularzy (niezależnych od stron).
 *
 * Formularz to self-contained artefakt:
 *  - ma swoje pola (fields)
 *  - deklaruje wymagane datasources (requires)
 *  - deklaruje co emituje (emits)
 *  - strona/proces go osadza i podpina mu dane
 *
 * Storage: localStorage z prefixem `dealer-fx:draft-form:`.
 */
import { Injectable, signal, computed } from '@angular/core';

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
}

export interface DraftForm {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly fields: ReadonlyArray<DraftFormField>;
  readonly submitLabel?: string;
  readonly requires: ReadonlyArray<string>;
  readonly emits: ReadonlyArray<{ event: string; description?: string }>;
  readonly createdAt: number;
  readonly updatedAt: number;
}

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
    const withTs: DraftForm = { ...form, updatedAt: now, createdAt: form.createdAt || now };
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
