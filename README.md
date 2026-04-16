# Dealer FX

Aplikacja dla dealerów FX (klienci, RFQ, monitor pozycji) — **na Echelon framework z npmjs**, zero linków do `ng-engine`.

## Run

```sh
npm install
npm start
# → http://localhost:4200
```

## Cały bootstrap = jedno wywołanie

`src/app/app.config.ts` — całe DI + asset loader + routing w ~30 liniach:

```ts
provideEchelon({
  widgets: [PageTitle, ClientCard, PositionRow, DealerQuoteForm, ...],
  computedFns: COMPUTED_FNS,
  pages: ['dashboard','clients','quote','positions'],
  transportDatasources: { spotUsdPln: 'rates.usdpln', clientsList: 'clients.list' },
  fixtures: { 'clients.list': '/assets/fixtures/clients.json' },
  streamSimulators: { 'rates.usdpln': { kind:'fx-random-walk', mid:4.05, ... } },
})
```

To pobiera `/assets/pages/<id>.jsonc` per id z `pages:`, mapuje fixtures do mock transportu,
rejestruje widgety z `@EchelonWidget` metadata, podpina computed fns. Zero własnego loadera.

## Struktura

```
src/
  app/
    app.config.ts              # Bootstrap (~30 LOC) ─ całe wpięcie frameworka
    app.component.ts           # Sidebar + <router-outlet/>
    computed-fns.ts            # Pure functions wywoływane z JSONC
    widgets/                   # Custom widgety domenowe (5×) — wszystkie @EchelonWidget
  assets/
    pages/                     # Definicje stron — pełna logika tu
      dashboard.jsonc          # KPI tiles + live spot
      clients.jsonc            # Search + computed filter
      quote.jsonc              # RFQ form + callComputed
      positions.jsonc          # Live blotter + close action
    fixtures/                  # JSON loadowane do mock transportu jako responses
```

## Cztery strony pokazują różne mechaniki

| URL | Co pokazuje |
|---|---|
| `/d/dashboard` | KPI tiles binded do live spot stream + computed total P&L |
| `/d/clients`   | Lokalna `searchQuery` + computed `filterClients`, output → handler |
| `/d/quote`     | Wybór klienta (cross-widget przez event bus) + form + `callComputed` action |
| `/d/positions` | Live blotter z mark price + akcja close (handler emit'uje na bus) |

## Jak dodać własną stronę

1. `src/assets/pages/moja.jsonc` — skopiuj wzór, JSONC `{ "page": { id, layout, widgets, datasources, eventHandlers } }`.
2. Dodaj `'moja'` do `pages:` w `app.config.ts`.
3. Reload — strona pod `/d/moja`.

**Zero TS.** Widget już jest, datasource się binduje, event handler zadziała.

## Jak dodać własny widget

1. `src/app/widgets/moj-widget.component.ts`:
   ```ts
   @EchelonWidget({
     manifest: { type: 'moj-widget', version: '1.0.0', inputs: [...], outputs: [...], capabilities: {...}, ... },
     selector: 'fx-moj-widget',
     template: `...`,
     imports: [CommonModule],
   })
   export class MojWidget { @Input() ...; @Output() ... = new EventEmitter<...>(); }
   ```
2. Dodaj klasę do `widgets:` w `app.config.ts`.
3. Użyj w JSONC pod `"type": "moj-widget"`.

## Konwencje

- **Bind paths**: `"bind": { "valueX": "datasourceId" }` lub dot path.
- **Event names**: `"<widgetId>.<outputName>"` — auto z manifestu.
- **When**: `"when": { "path": "...", "exists": true }` lub `eq/in/gt/and/or/not`.
- **Actions**: `setDatasource` / `clearDatasource` / `appendDatasource` / `emit` / `fetch` / `callComputed`.
