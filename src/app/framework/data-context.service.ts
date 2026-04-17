/**
 * DataContextService — hierarchiczny kontekst danych.
 *
 * Kontener (tabela, data-view, list-detail) pushuje context:
 *   "bieżący rekord to Client#123 z DS clientsList"
 * Child widgets (formularz, karta, detail) dziedziczą:
 *   form.inputContract 'client' → resolves z nearest DataContext
 *
 * Wzorzec: Salesforce Record Context / OutSystems Data View.
 *
 * Stack-based: push/pop. Najbliższy context wins (child override parent).
 */
import { Injectable, signal, computed } from '@angular/core';
import type { DataContextBinding, OutputCardinality } from './schema-types';

export interface DataContextEntry {
  readonly id: string;
  readonly datasourceId: string;
  readonly modelId?: string;
  readonly cardinality: OutputCardinality;
  readonly value: unknown;
  readonly selection: unknown;
}

@Injectable({ providedIn: 'root' })
export class DataContextService {
  private readonly _stack = signal<ReadonlyArray<DataContextEntry>>([]);

  readonly stack = this._stack.asReadonly();

  readonly current = computed<DataContextEntry | null>(() => {
    const s = this._stack();
    return s.length > 0 ? s[s.length - 1] : null;
  });

  push(entry: DataContextEntry): void {
    this._stack.update((s) => [...s, entry]);
  }

  pop(id: string): void {
    this._stack.update((s) => s.filter((e) => e.id !== id));
  }

  updateSelection(id: string, selection: unknown): void {
    this._stack.update((s) =>
      s.map((e) => e.id === id ? { ...e, selection } : e));
  }

  updateValue(id: string, value: unknown): void {
    this._stack.update((s) =>
      s.map((e) => e.id === id ? { ...e, value } : e));
  }

  /**
   * Resolve — znajdź najbliższy context pasujący do datasourceId lub modelId.
   * Child widgets wołają to żeby dostać "bieżący rekord" bez ręcznego bind.
   */
  resolve(datasourceId?: string, modelId?: string): DataContextEntry | null {
    const s = this._stack();
    for (let i = s.length - 1; i >= 0; i--) {
      const e = s[i];
      if (datasourceId && e.datasourceId === datasourceId) return e;
      if (modelId && e.modelId === modelId) return e;
    }
    return null;
  }

  /**
   * Resolve selected value — wyciąga element z kontekstu.
   * Dla array DS z selection → zwraca wybrany element.
   * Dla single DS → zwraca wartość DS.
   */
  resolveSelectedValue(datasourceId?: string, modelId?: string): unknown {
    const ctx = this.resolve(datasourceId, modelId);
    if (!ctx) return undefined;
    if (ctx.cardinality === 'single') return ctx.value;
    if (ctx.selection !== undefined && ctx.selection !== null) return ctx.selection;
    return undefined;
  }
}
