# v0.2 Framework Integrations — dealer-fx-app demo

Ten plik opisuje jak nowe pakiety `@echelon-framework/*` są wdrożone w aplikacji dealera.

## Przegląd

| Pakiet | Użyte w | Co robi |
|---|---|---|
| `@echelon-framework/expression` | `framework-integrations.ts` | Silnik wyrażeń dla `computed`/`when` (z custom `pips`, `fmtPln`). |
| `feature-flags` (runtime) | `positions.page.ts`, `quote.page.ts` | `candlestick-chart` (role gate), `quote-form-v2` (20% rollout). |
| `i18n` (runtime) | `framework-integrations.ts`, wszystkie strony | Słowniki PL/EN + pluralizacja. |
| `telemetry + PerformanceMonitor` | `framework-integrations.ts` | Budowanie bufora metryk z Prometheus exportem. |
| `@echelon-framework/charts-echarts` | `positions.page.ts` | Candlestick chart P&L history (lazy echarts). |
| `@echelon-framework/export-core` | `positions.page.ts` + `app.component.ts` | CSV export pozycji (RFC 4180 + BOM). |
| `persistence` + `LocalStorageAdapter` | `quote.page.ts` via `draftQuote` local | Auto-save formularza quote. |
| `tenant-context` | `framework-integrations.ts` | Single-tenant 'dealer-corp' z brandingiem. |
| `SchemaMigrationRegistry` | (gotowe do użycia) | Auto-migrate JSON configów między wersjami. |
| `circuit breaker` / `bulkhead` | Można dodać per datasource w `pnl-history.ds.ts` przez `errorPolicy` | Resilience dla HTTP. |
| `IndexedDBStorage` | (gotowy do użycia zamiast localStorage dla blotter history) | Dla offline scenariuszy. |
| `WorkerPool` | (gotowy do użycia dla `positionsTotalPnl` gdy pozycji > 1000) | Offload compute do WebWorker. |

## CSV Export flow

```
[positions-blotter] → actions[exportCsv] → emit 'positions.exportCsv'
     ↓
[handler] → emit 'fx.positions.csv.download-requested' (clean event, bez side-effectu)
     ↓
[app.component] → eventBus.on() → exportPositionsToCsv() → RFC 4180 + downloadCsv()
```

Luźne couplingowanie: konfig pozostaje deklaratywny, side-effect z `download` trafia do code-behind.

## Feature flag rollout

```typescript
// framework-integrations.ts
{ key: 'quote-form-v2', rollout: 0.2, regions: ['EU'] }
```

- Deterministic FNV-1a hash po `userId` → ten sam user widzi zawsze tę samą wersję.
- Region check: tylko EU (US user zobaczy legacy niezależnie od rollout).
- Kill switch: `featureFlags.upsert({ key: 'quote-form-v2', enabled: false })` — instant disable.

## i18n + pluralizacja

```typescript
i18n.t('positions.count', { count: 3 })
// PL: "3 pozycje"  (few)
// EN: "3 positions" (other)
```

- ICU pluralRules via `Intl.PluralRules`
- Fallback z PL → EN → klucz (missing-key pass-through)
- Intl.NumberFormat przez `formatCurrency('PLN')` → "1 234,56 zł"

## Cache strategy na `pnlHistory`

```typescript
cache: {
  ttl: 60_000,                                                  // 1 min
  strategy: 'stale-while-revalidate',                           // stary + refresh w tle
  tags: ['positions', 'pnl'],                                   // grupowa invalidacja
  invalidateOn: ['fx.position.closed', 'fx.positions.csv.download-requested'],
}
```

EventBus → `cache-wiring.wireCacheInvalidationFromEvents()` → automatyczna invalidacja.

## Generowanie flow graph z CLI

```bash
# Zapisz config do JSON (np. przez PageBuilder → toConfig())
npx echelon flow ./positions.config.json --direction LR > positions.mermaid

# Podgląd: mermaid.live, VS Code preview, albo bezpośrednio w dokumentacji
```

## Telemetry → /metrics endpoint

```typescript
import { toPrometheus } from '@echelon-framework/runtime';

app.get('/metrics', (req, res) => {
  res.type('text/plain').send(toPrometheus(telemetry.snapshot()));
});
```

## Czego jeszcze brakuje (future work)

- `designer-app` — Angular UI dla Page Designera (DnD grid + inspector + live preview).
- `devtools-panel` — Ctrl+Shift+Alt+E UI.
- Dedykowana ng-packagr compilation widgets-core żeby można było importować `<ech-app-shell>` bezpośrednio.
- Serwerowy pull feature flag config (obecnie statyczny in-memory).
