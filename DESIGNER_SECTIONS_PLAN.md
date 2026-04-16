# Designer — plan rozbicia na sekcje

> **Kontekst (2026-04-16):** Designer rośnie, jedna strona `/designer` mieści
> już palette + canvas + inspector + page picker + new-page wizard + save dialog
> + ds dialog. Form builder jest wciśnięty w inspector (za mało miejsca na bogatą
> funkcjonalność). Data sources edytuje się inline w inspectorze (bez preview /
> testu live value). Menu editor jest już osobną stroną i dobrze działa —
> idziemy tą samą drogą dla reszty.

## 1. Stan obecny (po M29, 2026-04-16)

Jedna strona `/designer` z `fx-designer-shell` (≈2200 LoC):
- **Page picker** (dropdown top)
- **Palette** (lewa, 260px) — ~23 widgety z WIDGET_REGISTRY
- **Canvas** (środek) — 4 tabs: Layout / Preview / TS / JSON
- **Inspector** (prawa, 340px) — manifest slots, bind/options, layout, form
  builder, datasources list, computed list, handlers list, page meta

Plus modale: save dialog, new page wizard, datasource creator/editor.

**Problemy:**
1. **Form builder jest wciśnięty** — sekcja w inspectorze 340px szerokości,
   edycja pól sens tylko dla 2-3 walidatorów. Większa funkcjonalność (`onChange`,
   `onSubmit` actions per field) się nie mieści.
2. **Data sources bez testowania** — widzę listę ale nie widzę co zwraca,
   czy endpoint działa, jaka jest aktualna wartość.
3. **Kontekst gubiony** — gdy pracuję z formularzem, boczny panel jest
   zaśmiecony manifestem, bindami, layoutem. Za dużo naraz.
4. **Duplikacja** — datasource list pokazuje się w inspector per strona,
   ale nie ma widoku "wszystkie ds" global.

## 2. Docelowa struktura — 3 sekcje

```
/designer                 → Strony (page designer, obecny shell) — split bez
                            form buildera + ds list, ale zachowuje palette/
                            canvas/inspector
/designer/datasources     → Data Sources (NEW) — lista global + create/edit/test
/designer/forms           → Formularze (NEW) — lista form widgetów ze wszystkich
                            stron + dedykowany editor per form
```

Menu Dev:
```
Dev (defaultOpen)
├── 🎨 Pages Designer        → /designer
├── 📦 Data Sources Designer  → /designer/datasources    (NEW)
├── 📋 Forms Designer         → /designer/forms           (NEW)
├── 🧭 Menu Editor            → /menu-editor
├── 🎯 Business Flow          → /business-flow
└── 🔀 Process Flow           → /process-flow
```

### 2.1. Pages Designer (`/designer`) — zostaje, ale odchudza się
**Zatrzymujemy:**
- Page picker + new page wizard
- Palette
- Canvas (Layout / Preview / TS / JSON)
- Inspector: manifest slots, bind/options, layout, widget type

**Wynosimy do innych sekcji:**
- ❌ Data sources list w inspectorze → wszystkie operacje na ds w nowej sekcji
- ❌ Form builder w inspectorze (validated-form fields) → Forms Designer
- ✅ Zachowujemy "Używane datasources na stronie" jako read-only info
  (linki klikane → otwierają /designer/datasources?select=X)

### 2.2. Data Sources Designer (`/designer/datasources`) — NEW

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  📦 Data Sources    [6 total · 3 transport · 2 value · 1 computed]  │
│  [Szukaj__________] [+ Nowy datasource]                       │
├──────────────────────────────────────────────────────────────┤
│ LISTA (280px)          │  DETAIL (flex)                       │
│ ├ clientsList   transport│ 📦 clientsList — transport/http       │
│ ├ spotUsdPln    stream   │ Strona: Quote / Positions             │
│ ├ userName      value    │                                        │
│ ├ totalPnl      computed │ [▶ Test / Snapshot]  [✎ Edytuj] [🗑]  │
│ └ ...                   │                                        │
│                         │ ┌─ Konfiguracja ─┐ ┌─ Live snapshot ─┐│
│                         │ │ { kind: ...   } │ │ { id: 1, ... }  ││
│                         │ │ { transport...} │ │ { id: 2, ... }  ││
│                         │ └─────────────────┘ │ ✓ ready · 245ms ││
│                         │                     └──────────────────┘│
│                         │ ┌─ Użycie ──────────────────────────────┐│
│                         │ │ Quote Page → list.bind.clients         ││
│                         │ │ Clients Page → table.bind.rows         ││
│                         │ └────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

**Features:**
- ✅ Lista ze **wszystkich** stron (zarejestrowane + drafty) — oznaczenie źródła
- ✅ Search (id / pageTitle / endpoint)
- ✅ Per-kind counters w toolbar
- ✅ Klik ds → detail z 3 blokami:
  - Konfiguracja (JSON view, read-only)
  - Live snapshot (subscribe do DataBus, pokazuje aktualną wartość)
  - Użycie (lista: gdzie binding, który widget, który bind.key)
- ✅ Test button — wywołuje fetch/subscribe, status (loading/ready/error)
- ✅ Create ds (reuse M25 dialog) — na start tworzone jako **global** (nowa
  koncepcja: ds nie przypięty do konkretnej strony, dostępne w każdej)

**Global vs per-page ds** — decyzja projektowa:
- Framework obecnie ma ds per-page (`PageConfig.page.datasources`) + globalne
  przez `@DataSource` decorator (zarejestrowane w provideEchelon)
- W designerze proponuję: DS w tej sekcji może być **page-scoped** (zapisywany
  do wybranej strony) lub **draft global** (w localStorage jako osobna lista,
  serializowana później przez Save jako `@DataSource` class)
- Dla MVP: zostajemy przy page-scoped, user wybiera target page przy create
- Faza 2: global drafts → generuje TS do `src/app/datasources/*.ds.ts`

### 2.3. Forms Designer (`/designer/forms`) — NEW

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  📋 Forms Designer    [3 forms w aplikacji]                            │
│  [Szukaj___________]                                                    │
├──────────────────────────────────────────────────────────────────────┤
│ LISTA FORM (280px)       │  FORM EDITOR (flex, 3-col)                 │
│ ├ Quote Form             │ ┌─ FIELDS ───────┐ ┌─ PREVIEW ──────────┐ │
│ │  Quote Page / form     │ │ ⋮⋮ amount      │ │                      │ │
│ ├ Client Register        │ │ ⋮⋮ side        │ │  [ amount    ▢  ]    │ │
│ │  Onboarding / regForm  │ │ ⋮⋮ marginPips  │ │  [ side: BUY/SELL ]  │ │
│ ├ Transaction Edit       │ │ + field         │ │  [ marginPips: __ ]  │ │
│ │  Transactions / edit   │ │                │ │  [ Submit            ]│ │
│ └─ ...                   │ └─────────────────┘ └──────────────────────┘ │
│                          │ ┌─ FIELD DETAILS (dla zaznaczonego) ───────┐ │
│                          │ │ id: amount                                │ │
│                          │ │ label: Kwota                              │ │
│                          │ │ type: decimal ▼                           │ │
│                          │ │ [required] [readonly]                     │ │
│                          │ │ min: 0.01  max: 1000000                   │ │
│                          │ │                                           │ │
│                          │ │ ── VALIDACJA ──                           │ │
│                          │ │ • pattern: /^\d+(\.\d+)?$/                │ │
│                          │ │ [+ reguła]                                │ │
│                          │ │                                           │ │
│                          │ │ ── AKCJE NA POLU ── (NEW!)                │ │
│                          │ │ onChange:                                 │ │
│                          │ │   1. setDatasource: draft from $event     │ │
│                          │ │   2. emit: form.field.change               │ │
│                          │ │   [+ akcja]                               │ │
│                          │ │ onBlur:                                   │ │
│                          │ │   1. callComputed: validate → errors      │ │
│                          │ │   [+ akcja]                               │ │
│                          │ └───────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

**Features:**
- ✅ Lista form widgetów (type === 'validated-form' albo 'dealer-quote-form'
  itp. — konfigurowalny manifest category 'form')
- ✅ Klik formularza → dedykowany editor 3-col:
  - **Fields** (lewa): drag-reorder, add/remove (jak obecny form builder ale z
    większym miejscem)
  - **Preview** (środek): live render formularza (standalone WidgetHost mount —
    osobny od głównej strony żeby user widział TYLKO formularz)
  - **Field details** (prawa): edycja pola ROZSZERZONA o actions
- ✅ **Field actions** (NEW):
  - `onChange` — lista `EventAction[]` (to samo API co handlers strony, z M18)
  - `onBlur` — np. walidacja, auto-save draft
  - `onFocus` — np. clear error message
  - `onSubmit` — per-form (na poziomie form, nie field), ale editor w tym samym
    view

**Form submit flow** (przykład dla Quote):
```
user wpisuje amount → onChange: setDatasource(draft) + emit(form.changed)
                                                              ↓
user blur amount → onBlur: callComputed(validateAmount) → errors local ds
user klika submit → onSubmit:
    1. callComputed(computeDealerRate) → quoteResult
    2. emit(rfq.submitted, payload: {client, amount, rate})
    3. fetch(rfq-send-endpoint, params: {...})
    4. navigate(/confirmation?id=$event.id)
```

Każdy step to EventAction — UI pokazuje chain w stylu M18 handler actions.

**Rozszerzenie frameworka — NEW field shape:**
```ts
interface FormFieldDef {
  readonly id: string;
  readonly label: string;
  readonly type: FieldType;
  // ... istniejące validatory (min/max/pattern/required)

  // NEW — actions per field
  readonly actions?: {
    readonly onChange?: ReadonlyArray<EventAction>;
    readonly onBlur?: ReadonlyArray<EventAction>;
    readonly onFocus?: ReadonlyArray<EventAction>;
  };
}
```

ValidatedFormComponent musi subskrybować zmiany per field i executować
actions. To wymaga bumpa widgets-core (rc.17) + rozbudowy runtime actions
resolver żeby działał poza event-handler context.

## 3. Ścieżka dojścia — milestones

| # | Milestone | Czas | Ryzyko | Dependency |
|---|-----------|------|--------|------------|
| **M30** | `fx-datasource-designer` widget — standalone sekcja ze wszystkimi ds + test/snapshot | 2-3h | niskie — reuse istniejącego kodu | — |
| **M31** | Nowa strona `/designer/datasources` + wpis w menu | 15min | zero | M30 |
| **M32** | Data Sources — pełny CRUD (reuse dsDialog z M25) przeniesiony | 30min | niskie | M30 |
| **M33** | Usunięcie ds list z page inspector — zostawić tylko link do /designer/datasources | 20min | niskie — cleanup | M31 |
| **M34** | `fx-form-designer` widget — lista form widgetów + placeholder editor | 2h | średnie — widget manifest search | — |
| **M35** | Nowa strona `/designer/forms` + menu entry | 15min | zero | M34 |
| **M36** | Form editor — 3-col layout (fields list + preview + details) | 3-4h | średnie — live preview iframe/mount | M34 |
| **M37** | Field actions model extension (per-field `onChange/onBlur/onFocus`) + widgets-core bump | 2h | wysokie — zmiana frameworka, wymaga rc.17 bumpa | M36 |
| **M38** | Field actions UI — chain builder reuse M18 actions UX | 2h | niskie po M37 | M37 |
| **M39** | Usunięcie form builder z page inspector — link do /designer/forms | 15min | niskie | M36 |
| **M40** | Page designer focus cleanup — tylko layout/widgets/page meta w inspectorze | 30min | niskie | M33 + M39 |

**Total:** ~12-15 godzin pracy (rozłożone na kilka sesji). Połowa to refactor/
cleanup, druga połowa to nowa funkcjonalność.

## 4. Decyzje do podjęcia

### D1 — Sub-routing w /designer czy osobne strony?

**Opcja A:** Oddzielne strony — `/designer`, `/designer/datasources`, `/designer/forms`.
Każda ma własny `@Page` class + widget top-level. Prostsze, niezależne, menu
entry per sekcja.

**Opcja B:** Shell z router outlet — `/designer` ma tabs top (Pages/DS/Forms),
każdy tab ma własny child route. Jedna ścieżka w URL z zakładkami, wspólny
sidebar/header.

**Rekomendacja:** **A** (osobne strony). Dlaczego:
- Każda sekcja ma własną tożsamość w menu (user szuka "Data Sources" nie
  "/designer tab")
- Łatwiejsza rozbudowa (każda strona = osobny widget = osobne file)
- Share state jeśli potrzebny — przez usługi (DraftPageStore już istnieje)

### D2 — Form actions — extend widgets-core czy custom fork?

**Opcja A:** Bump widgets-core (rc.17) — `FormFieldDef.actions` native support.
Wymaga zmian w `ValidatedFormComponent` (subskrypcja value changes per field →
dispatch actions przez runtime).

**Opcja B:** Custom `fx-advanced-form` widget w dealer-fx-app — own component,
własny model, własne actions. Nie blokuje rozwoju ale duplikuje logikę.

**Rekomendacja:** **B najpierw, potem A**. Dlaczego:
- B → szybki MVP w dealer-fx-app, testujemy UX bez bumpa frameworka
- A → gdy model action per-field się sprawdzi, promocja do core

### D3 — Gdzie trzymać drafty datasources?

**Opcja A:** Każdy ds jest page-scoped (obecnie w `PageConfig.page.datasources`).
Tworzenie ds w nowej sekcji wymaga wyboru target page.

**Opcja B:** Dodać "global drafts" — osobna lista w `DraftPageStoreService`
(albo nowy `DraftDatasourceStoreService`). Generate TS do
`src/app/datasources/<id>.ds.ts` przy save.

**Rekomendacja:** **A** (zostajemy na per-page). Globalny model wymaga:
- Nowego storage scope
- Serializacji do @DataSource decorator (TS generation — ts-morph)
- Conflict detection (czy global ds nie przykrywa page-scoped)

To duży koszt. Zaczynamy od A — user w DS designerze wybiera page target,
widzi listę global. Global drafts M40+ jeśli use case się pojawi.

## 5. Następny krok — TERAZ

1. **Potwierdź plan** (lub zgłoś zmiany)
2. Startujemy **M30** — `fx-datasource-designer` widget (już częściowo
   zacząłem w sesji, wystarczy dokończyć) i **M31** — strona + menu
3. Po commit — M32 (CRUD) i M33 (cleanup page inspector)
4. Potem M34-M36 — Forms designer
5. Dopiero wtedy M37-M38 — rozszerzenie frameworka o field actions (bumpa rc.17)

Dzięki temu user dostaje wartość **po każdym etapie**:
- Po M33: Data Sources ma własną sekcję, page inspector jest lżejszy
- Po M36: Form Builder ma pełną przestrzeń roboczą
- Po M38: Pola formularza dostają event-driven actions (prawdziwa logika
  biznesowa w configu bez TypeScripta)

## Historia

| Data | Wpis |
|---|---|
| 2026-04-16 | Pierwsza wersja — plan podziału na 3 sekcje po M29 |
