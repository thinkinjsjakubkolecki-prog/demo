/**
 * DraftPageStore — persystentne drafty stron w localStorage.
 *
 * Drafty designer'a są zapisywane tutaj żeby:
 *  - przetrwały reload przeglądarki,
 *  - były dostępne przez dynamiczny route `/draft/:id`,
 *  - mogły być linkowane w menu (Menu Editor widzi je obok zarejestrowanych stron).
 *
 * Storage: localStorage z prefixem `dealer-fx:draft-page:`. Każdy draft
 * to osobny klucz — pozwala to na niezależne update bez kolizji.
 */
import { Injectable, signal, computed } from '@angular/core';
import type { PageConfig } from '@echelon-framework/core';

export interface PersistedDraft {
  readonly id: string;
  readonly title: string;
  readonly route: string;
  readonly config: PageConfig;
  readonly className: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

const STORAGE_PREFIX = 'dealer-fx:draft-page:';
const INDEX_KEY = 'dealer-fx:draft-page-index';

@Injectable({ providedIn: 'root' })
export class DraftPageStoreService {
  private readonly drafts = signal<ReadonlyArray<PersistedDraft>>([]);
  readonly all = computed<ReadonlyArray<PersistedDraft>>(() => this.drafts());

  constructor() {
    this.loadFromStorage();
  }

  get(id: string): PersistedDraft | null {
    return this.drafts().find((d) => d.id === id) ?? null;
  }

  save(draft: PersistedDraft): void {
    const now = Date.now();
    const withTimestamp: PersistedDraft = { ...draft, updatedAt: now, createdAt: draft.createdAt || now };
    this.writeToStorage(withTimestamp);
    this.drafts.update((list) => {
      const without = list.filter((d) => d.id !== draft.id);
      return [...without, withTimestamp];
    });
  }

  remove(id: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_PREFIX + id);
      this.updateIndex((ids) => ids.filter((x) => x !== id));
    }
    this.drafts.update((list) => list.filter((d) => d.id !== id));
  }

  /** Zmiana config draftu — alias na save z zachowaniem createdAt. */
  update(id: string, config: PageConfig, title?: string): void {
    const existing = this.get(id);
    if (!existing) return;
    this.save({
      ...existing,
      config,
      title: title ?? existing.title,
    });
  }

  /** Upsert completed draft — używany gdy designer chce zapisać zmiany. */
  upsert(partial: Omit<PersistedDraft, 'createdAt' | 'updatedAt'>): void {
    const existing = this.get(partial.id);
    const now = Date.now();
    this.save({
      ...partial,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const indexRaw = window.localStorage.getItem(INDEX_KEY);
      const ids: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      const loaded: PersistedDraft[] = [];
      for (const id of ids) {
        const raw = window.localStorage.getItem(STORAGE_PREFIX + id);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as PersistedDraft;
          if (parsed && parsed.id === id) loaded.push(parsed);
        } catch {
          // Cicho ignoruj corrupted entries
        }
      }
      this.drafts.set(loaded);
    } catch {
      this.drafts.set([]);
    }
  }

  private writeToStorage(draft: PersistedDraft): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_PREFIX + draft.id, JSON.stringify(draft));
    this.updateIndex((ids) => (ids.includes(draft.id) ? ids : [...ids, draft.id]));
  }

  private updateIndex(mutator: (ids: string[]) => string[]): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const current = window.localStorage.getItem(INDEX_KEY);
    const ids: string[] = current ? JSON.parse(current) : [];
    const next = mutator(ids);
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(next));
  }

  /** Debug — clear all drafts. */
  clear(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const current = window.localStorage.getItem(INDEX_KEY);
    const ids: string[] = current ? JSON.parse(current) : [];
    for (const id of ids) window.localStorage.removeItem(STORAGE_PREFIX + id);
    window.localStorage.removeItem(INDEX_KEY);
    this.drafts.set([]);
  }
}
