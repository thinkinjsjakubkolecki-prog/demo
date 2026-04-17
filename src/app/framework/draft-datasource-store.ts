/**
 * DraftDatasourceStore — persystentne standalone datasources z typed kontraktem.
 *
 * Datasource to producent danych z deklaracją:
 *  - inputSchema: jakie parametry przyjmuje (do fetch/refresh)
 *  - outputSchema: jaki kształt danych produkuje
 *  - refreshOn: kiedy się odświeża (eventy)
 *
 * Formularz konsumuje dane DS — designer waliduje kompatybilność:
 *   DS.outputSchema ⊇ Form.inputContract.schema
 */
import { Injectable, signal, computed } from '@angular/core';
import type { Schema, DatasourceContract } from './schema-types';

export interface DraftDatasource {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly kind: 'transport' | 'local' | 'computed' | 'stream';
  readonly transport?: 'http' | 'websocket' | 'mock';
  readonly endpoint?: string;
  readonly initial?: unknown;
  readonly fn?: string;
  readonly deps?: ReadonlyArray<string>;
  /** Typed contract — co DS produkuje i co potrzebuje. */
  readonly contract: DatasourceContract;
  readonly createdAt: number;
  readonly updatedAt: number;
}

const STORAGE_PREFIX = 'dealer-fx:draft-ds:';
const INDEX_KEY = 'dealer-fx:draft-ds-index';

@Injectable({ providedIn: 'root' })
export class DraftDatasourceStoreService {
  private readonly items = signal<ReadonlyArray<DraftDatasource>>([]);
  readonly all = computed<ReadonlyArray<DraftDatasource>>(() => this.items());

  constructor() {
    this.loadFromStorage();
  }

  get(id: string): DraftDatasource | null {
    return this.items().find((d) => d.id === id) ?? null;
  }

  save(ds: DraftDatasource): void {
    const now = Date.now();
    const withTs: DraftDatasource = { ...ds, updatedAt: now, createdAt: ds.createdAt || now };
    this.writeToStorage(withTs);
    this.items.update((list) => {
      const without = list.filter((d) => d.id !== ds.id);
      return [...without, withTs];
    });
  }

  remove(id: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_PREFIX + id);
      this.updateIndex((ids) => ids.filter((x) => x !== id));
    }
    this.items.update((list) => list.filter((d) => d.id !== id));
  }

  upsert(partial: Omit<DraftDatasource, 'createdAt' | 'updatedAt'>): void {
    const existing = this.get(partial.id);
    const now = Date.now();
    this.save({ ...partial, createdAt: existing?.createdAt ?? now, updatedAt: now });
  }

  updateContract(id: string, contract: DatasourceContract): void {
    const existing = this.get(id);
    if (!existing) return;
    this.save({ ...existing, contract });
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(INDEX_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const loaded: DraftDatasource[] = [];
      for (const id of ids) {
        const r = window.localStorage.getItem(STORAGE_PREFIX + id);
        if (!r) continue;
        try {
          const parsed = JSON.parse(r) as DraftDatasource;
          if (parsed && parsed.id === id) loaded.push(parsed);
        } catch { /* skip */ }
      }
      this.items.set(loaded);
    } catch { this.items.set([]); }
  }

  private writeToStorage(ds: DraftDatasource): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_PREFIX + ds.id, JSON.stringify(ds));
    this.updateIndex((ids) => ids.includes(ds.id) ? ids : [...ids, ds.id]);
  }

  private updateIndex(mutator: (ids: string[]) => string[]): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const current = window.localStorage.getItem(INDEX_KEY);
    const ids: string[] = current ? JSON.parse(current) : [];
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(mutator(ids)));
  }
}
