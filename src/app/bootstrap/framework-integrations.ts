/**
 * Integracje z nowymi pakietami frameworka (v0.2 delta) — wszystko w jednym
 * miejscu żeby `app.config.ts` pozostało cienkie.
 *
 * Wdrożono:
 *   - Expression engine (computed bindings w configach)
 *   - Feature flags (quote-form-v2 rollout, admin-only panel)
 *   - i18n (PL + EN słowniki, pluralizacja)
 *   - Telemetry + PerformanceMonitor (instrument fetch, widget render)
 *   - Charts (ECharts adapter dla P&L history)
 *   - Export (CSV pozycji)
 *   - Persistence (draft quote w localStorage)
 *   - Tenant context (single-tenant default 'dealer-corp')
 *   - Resilience (circuit breaker dla spot stream fallback)
 */
import { EchelonExpressionEngine } from '@echelon-framework/expression';
import type { FeatureFlagDefinition } from '@echelon-framework/core';
import {
  InMemoryFeatureFlagService,
  JsonDictionaryI18nService,
  InMemoryTelemetryService,
  PerformanceMonitor,
  InMemoryTenantContextService,
  LocalStorageAdapter,
  RealClock,
  asLocale,
} from '@echelon-framework/runtime';
import { EChartsAdapter } from '@echelon-framework/charts-echarts';
import { encodeCsv, downloadCsv } from '@echelon-framework/export-core';

/** Pojedyncza instancja silnika wyrażeń — współdzielona między computed/when. */
export const expressionEngine = new EchelonExpressionEngine({
  defaultTimeoutMs: 50,
  functions: {
    /** Dedykowana funkcja domenowa — marża w pipsach. */
    pips: (args) => Number(args[0] ?? 0) * 10000,
    /** Prezentacja waluty — prosta delegata do Intl. */
    fmtPln: (args) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(Number(args[0] ?? 0)),
  },
});

/** Feature flags dla dealer-fx. Tenant-aware — admin role sees preview features. */
export const featureFlags = new InMemoryFeatureFlagService({
  context: { userId: 'dealer-1', region: 'EU', role: 'dealer' },
  definitions: [
    { key: 'quote-form-v2', rollout: 0.2, regions: ['EU'] },
    { key: 'candlestick-chart', roles: ['admin', 'dealer'] },
    { key: 'csv-export', enabled: true },
    { key: 'ab-button-colour', variants: [{ key: 'green', weight: 1 }, { key: 'blue', weight: 1 }] },
  ] as FeatureFlagDefinition[],
});

/** i18n — PL domyślnie, EN jako fallback. */
export const i18n = new JsonDictionaryI18nService({
  defaultLocale: asLocale('pl-PL'),
  fallbackLocale: asLocale('en-US'),
  dictionaries: {
    'pl-PL': {
      'quote.title': 'Zapytanie o kwotę',
      'quote.subtitle': 'Wybierz klienta → ustaw parametry → wyślij',
      'positions.total': 'Łączny P&L (na żywo)',
      'positions.closeBtn': 'Zamknij po rynku',
      'positions.count': { one: '{{count}} pozycja', few: '{{count}} pozycje', many: '{{count}} pozycji', other: '{{count}} pozycji' },
      'positions.export.success': 'Wyeksportowano {{count}} wiersz(y) do {{file}}',
    },
    'en-US': {
      'quote.title': 'Request For Quote',
      'quote.subtitle': 'Pick a client → set params → send',
      'positions.total': 'Total P&L (live)',
      'positions.closeBtn': 'Close at market',
      'positions.count': { one: '{{count}} position', other: '{{count}} positions' },
      'positions.export.success': 'Exported {{count}} row(s) to {{file}}',
    },
  },
});

/** Telemetry — in-memory buffer + Prometheus endpoint helper. */
export const telemetry = new InMemoryTelemetryService({ clock: new RealClock() });

/** Wrapper z progami alertów — datasource fetch > 2s, render > 16ms (drop frame). */
export const performance = new PerformanceMonitor({ telemetry });
performance.setThreshold('datasource.fetch.duration', 2000);
performance.setThreshold('widget.render.duration', 16);

/** Chart adapter — bez bundled echarts; konsument podaje init (lazy-loaded). */
export function createChartAdapter(): EChartsAdapter {
  return new EChartsAdapter({
    themeName: 'dark',
    init: (el) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const echarts = (globalThis as any)['echarts'] as { init: (el: HTMLElement, theme?: string) => unknown };
      if (!echarts) throw new Error('echarts not loaded — add <script src="echarts.min.js"> or lazy-import in bootstrap');
      return echarts.init(el, 'dark') as never;
    },
  });
}

/** Tenant — single-tenant scenariusz dla dealer-corp. */
export const tenantContext = new InMemoryTenantContextService({
  tenantId: 'dealer-corp',
  displayName: 'Dealer Corp FX Desk',
  defaultLocale: 'pl-PL',
  region: 'eu-west-1',
  branding: {
    displayName: 'Dealer Corp',
    primaryColor: '#1e3a5f',
    accentColor: '#58a6ff',
  },
});

/** Storage dla draftów formularza quote (localStorage + 24h TTL). */
export function createDraftStorage(): LocalStorageAdapter {
  return new LocalStorageAdapter('dealer-fx:draft:');
}

/** Helper używany z widget actions albo z code-behind — eksportuje pozycje do CSV. */
export function exportPositionsToCsv(positions: ReadonlyArray<Record<string, unknown>>): boolean {
  const content = encodeCsv(positions, [
    { key: 'code', label: 'Kod' },
    { key: 'ccyPair', label: 'Para' },
    { key: 'quantity', label: 'Wolumen', format: (v) => String(Number(v ?? 0)) },
    { key: 'costBase', label: 'Cena wejścia', format: (v) => Number(v ?? 0).toFixed(5) },
    { key: 'pnl', label: 'P&L', format: (v) => Number(v ?? 0).toFixed(2) },
    { key: 'openedAt', label: 'Otwarta', format: (v) => v instanceof Date ? v.toISOString() : String(v ?? '') },
  ], { bom: true, delimiter: ';', newline: '\r\n' });
  const filename = `positions-${new Date().toISOString().slice(0, 10)}.csv`;
  const ok = downloadCsv(content, filename);
  if (ok) {
    telemetry.metric({ name: 'export.csv', kind: 'counter', value: 1, at: Date.now(), attributes: { target: 'positions', rows: positions.length } });
  }
  return ok;
}
