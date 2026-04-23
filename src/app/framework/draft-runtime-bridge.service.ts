/**
 * DraftRuntimeBridge — most między Draft Stores (localStorage) a DataBus (runtime).
 *
 * Problem: designery zapisują do DraftDatasourceStore/DraftFormStore (localStorage).
 * Runtime (PageRendererComponent, form-ref, lookup) czyta z DataBus (Angular DI).
 * Te dwa światy się nie widzą → draft pages nie mają danych.
 *
 * Rozwiązanie: ten bridge rejestruje draft datasources w DataBus jako tymczasowe
 * sources. Gdy DraftPageRenderer montuje stronę:
 *   1. Czyta draft DS z DraftDatasourceStore
 *   2. Pushuje dane (initial/mock) do DataBus jako DataSource
 *   3. Symuluje mock behavior (delay, error rate, streaming)
 *   4. form-ref/lookup resolve normalnie z DataBus
 *
 * Bridge żyje per-page render — cleanup przy unmount.
 */
import { Injectable, inject, type OnDestroy } from '@angular/core';
import { DATA_BUS } from '@echelon-framework/runtime';
import type { DataBus } from '@echelon-framework/core';
import { DraftDatasourceStoreService, type DraftDatasource, type MockConfig } from './draft-datasource-store';
import { DraftFormStoreService } from './draft-form-store';

interface ActiveMock {
  readonly dsId: string;
  timer?: ReturnType<typeof setInterval>;
}

@Injectable({ providedIn: 'root' })
export class DraftRuntimeBridgeService implements OnDestroy {
  private readonly dataBus = inject(DATA_BUS, { optional: true }) as DataBus | null;
  private readonly dsStore = inject(DraftDatasourceStoreService);
  private readonly formStore = inject(DraftFormStoreService);
  private readonly activeMocks: ActiveMock[] = [];

  /**
   * Zarejestruj wszystkie draft datasources w DataBus.
   * Wywołaj przy renderze draft page.
   */
  bridgeAll(): void {
    if (!this.dataBus) return;

    // Draft datasources (standalone)
    for (const ds of this.dsStore.all()) {
      this.bridgeDatasource(ds);
    }

    // Formularze jako datasources
    for (const form of this.formStore.all()) {
      if (form.registerAsDatasource && form.outputModel) {
        this.bridgeFormAsDatasource(form.id);
      }
    }
  }

  /**
   * Zarejestruj pojedynczy draft DS w DataBus.
   */
  bridgeDatasource(ds: DraftDatasource): void {
    if (!this.dataBus) return;

    const source = this.dataBus.source(ds.id as never) as {
      push?: (value: unknown) => void;
      setLoading?: () => void;
    };

    if (!source || typeof source.push !== 'function') return;

    const mock = ds.mockConfig;
    if (!mock || mock.behavior === 'static') {
      // Static: push initial data immediately
      if (ds.initial !== undefined) {
        source.push(ds.initial);
      }
    } else if (mock.behavior === 'http') {
      // HTTP simulation: delay + optional error
      this.simulateHttp(source, ds.initial, mock);
    } else if (mock.behavior === 'stream') {
      // Stream simulation: periodic ticks
      this.simulateStream(source, ds, mock);
    }
  }

  /**
   * Zarejestruj formularz jako datasource (push empty initial).
   */
  bridgeFormAsDatasource(formId: string): void {
    if (!this.dataBus) return;
    const source = this.dataBus.source(formId as never) as {
      push?: (value: unknown) => void;
    };
    if (source && typeof source.push === 'function') {
      source.push({});
    }
  }

  /**
   * Cleanup — zatrzymaj wszystkie symulacje.
   */
  cleanup(): void {
    for (const mock of this.activeMocks) {
      if (mock.timer) clearInterval(mock.timer);
    }
    this.activeMocks.length = 0;
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  // ─── Simulators ───────────────────────────────────────────────────────

  private simulateHttp(
    source: { push?: (v: unknown) => void; setLoading?: () => void },
    data: unknown,
    mock: MockConfig,
  ): void {
    const delay = mock.delay ?? 500;
    const errorRate = mock.errorRate ?? 0;

    if (typeof source.setLoading === 'function') source.setLoading();

    setTimeout(() => {
      if (errorRate > 0 && Math.random() * 100 < errorRate) {
        // Simulate error — push error message
        console.warn(`[draft-bridge] Mock HTTP error for DS (${errorRate}% rate):`, mock.errorMessage);
        return;
      }
      if (typeof source.push === 'function' && data !== undefined) {
        source.push(data);
      }
    }, delay);
  }

  private simulateStream(
    source: { push?: (v: unknown) => void },
    ds: DraftDatasource,
    mock: MockConfig,
  ): void {
    const intervalMs = mock.intervalMs ?? 1000;
    const simulator = mock.simulator ?? 'cycle';

    const activeMock: ActiveMock = { dsId: ds.id };
    this.activeMocks.push(activeMock);

    if (simulator === 'cycle' && Array.isArray(ds.initial)) {
      // Cycle through data items
      const items = ds.initial as unknown[];
      let idx = 0;
      activeMock.timer = setInterval(() => {
        if (typeof source.push === 'function' && items.length > 0) {
          source.push(items[idx % items.length]);
          idx++;
        }
      }, intervalMs);
    } else if (simulator === 'fx-random-walk') {
      // FX random walk (bid/ask)
      let mid = mock.mid ?? 4.05;
      const vol = mock.vol ?? 0.0003;
      const precision = mock.precision ?? 5;
      activeMock.timer = setInterval(() => {
        const change = (Math.random() - 0.5) * 2 * vol;
        mid += change;
        const spread = mid * 0.0002;
        const tick = {
          bid: +(mid - spread).toFixed(precision),
          ask: +(mid + spread).toFixed(precision),
          mid: +mid.toFixed(precision),
          at: Date.now(),
        };
        if (typeof source.push === 'function') source.push(tick);
      }, intervalMs);
    } else if (simulator === 'sine') {
      // Sine wave
      const amplitude = mock.amplitude ?? 1;
      const periodMs = mock.periodMs ?? 10000;
      const start = Date.now();
      activeMock.timer = setInterval(() => {
        const elapsed = Date.now() - start;
        const value = amplitude * Math.sin((2 * Math.PI * elapsed) / periodMs);
        if (typeof source.push === 'function') source.push({ value: +value.toFixed(4), at: Date.now() });
      }, intervalMs);
    } else if (simulator === 'random-int') {
      // Random integers
      const min = mock.min ?? 1;
      const max = mock.max ?? 100;
      activeMock.timer = setInterval(() => {
        const value = Math.floor(Math.random() * (max - min + 1)) + min;
        if (typeof source.push === 'function') source.push({ value, at: Date.now() });
      }, intervalMs);
    }

    // Push initial value immediately
    if (ds.initial !== undefined && typeof source.push === 'function') {
      source.push(ds.initial);
    }
  }
}
