/**
 * Demo nowego data flow przez WidgetPort API.
 *
 * Pokazuje na zywo:
 *  - resolvePortSourceSnapshot z transform=filter (lista klientow filtrowana po formie)
 *  - executePortTargets (multi-target: setSession + navigate na klik wiersza)
 *  - BUILTIN_TRANSFORMS (filter, pluck, map) — tooltip pokazuje co robi
 *
 * Nic z page-renderera. Czyste API z @echelon-framework/designer-core.
 */
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  resolvePortSourceSnapshot,
  executePortTargets,
  listSourceDependencies,
  type PortSource,
  type PortTarget,
  type PortResolverContext,
  type PortTargetEffects,
} from '@echelon-framework/designer-core';

const SEED_CLIENTS = [
  { id: 'C-1001', name: 'Acme Sp. z o.o.',     email: 'biuro@acme.pl',          phone: '+48 600 100 001', segment: 'corporate', status: 'open',    address: 'Warszawa' },
  { id: 'C-1002', name: 'Janusz Kowalski',     email: 'jkowalski@op.pl',        phone: '+48 600 100 002', segment: 'retail',    status: 'open',    address: 'Krakow'   },
  { id: 'C-1003', name: 'BrightTech Sp.j.',    email: 'kontakt@brighttech.pl',  phone: '+48 600 100 003', segment: 'sme',       status: 'open',    address: 'Wroclaw'  },
  { id: 'C-1004', name: 'Anna Nowak',          email: 'anowak@gmail.com',       phone: '+48 600 100 004', segment: 'retail',    status: 'closed',  address: 'Poznan'   },
  { id: 'C-1005', name: 'Globex Industries',   email: 'info@globex.pl',         phone: '+48 600 100 005', segment: 'corporate', status: 'frozen',  address: 'Gdansk'   },
  { id: 'C-1006', name: 'StartHub Lab',        email: 'hello@starthub.lab',     phone: '+48 600 100 006', segment: 'sme',       status: 'open',    address: 'Lodz'     },
];

@Component({
  selector: 'app-port-flow-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <header>
        <h1>🔌 Port Flow Demo</h1>
        <p>
          Czyste API z <code>&#64;echelon-framework/designer-core</code> — bez page-renderera,
          bez DataBus, bez DraftPageStore. Tylko <code>resolvePortSourceSnapshot</code>
          + <code>executePortTargets</code> + transformy.
        </p>
      </header>

      <section class="grid">
        <!-- LEFT: filtry + lista -->
        <div class="card">
          <h2>filter-form (input)</h2>
          <p class="muted">Source: <code>{{ filterFormSourceJson() }}</code></p>
          <div class="filters">
            <label>Nazwa: <input type="text" [ngModel]="formName()" (ngModelChange)="formName.set($event)" placeholder="np. acme" /></label>
            <label>Segment:
              <select [ngModel]="formSegment()" (ngModelChange)="formSegment.set($event)">
                <option value="">--</option>
                <option value="corporate">corporate</option>
                <option value="retail">retail</option>
                <option value="sme">sme</option>
              </select>
            </label>
            <label>Status:
              <select [ngModel]="formStatus()" (ngModelChange)="formStatus.set($event)">
                <option value="">--</option>
                <option value="open">open</option>
                <option value="closed">closed</option>
                <option value="frozen">frozen</option>
              </select>
            </label>
            <button (click)="reset()">Wyczysc</button>
          </div>
        </div>

        <div class="card">
          <h2>data-table (transform = filter)</h2>
          <p class="muted">
            inPort.rows źródło:
            <code>transform&#123;filter, input=DS(clients), predicate=session(filters)&#125;</code>
          </p>
          <p class="muted">Deps: <code>{{ depsJson() }}</code></p>
          <table>
            <thead>
              <tr><th>ID</th><th>Nazwa</th><th>Segment</th><th>Status</th></tr>
            </thead>
            <tbody>
              @for (row of filteredRows(); track row.id) {
                <tr (click)="rowClick(row)">
                  <td>{{ row.id }}</td>
                  <td>{{ row.name }}</td>
                  <td>{{ row.segment }}</td>
                  <td>{{ row.status }}</td>
                </tr>
              }
              @if (filteredRows().length === 0) {
                <tr><td colspan="4" class="empty">Brak wynikow dla aktualnych filtrow</td></tr>
              }
            </tbody>
          </table>
          <p class="muted">Pokazano {{ filteredRows().length }} z {{ allRows().length }}</p>
        </div>
      </section>

      <section class="card">
        <h2>State (DataBus + Session — zarzadzane signalami w demo)</h2>
        <div class="state-grid">
          <div>
            <strong>datasources.clients</strong>
            <pre>{{ allRowsJson() }}</pre>
          </div>
          <div>
            <strong>datasources.filters</strong> <em>(z formularza)</em>
            <pre>{{ filtersJson() }}</pre>
          </div>
          <div>
            <strong>session</strong>
            <pre>{{ sessionJson() }}</pre>
          </div>
          <div>
            <strong>navigate log</strong>
            <pre>{{ navLog().join('\n') || '(brak)' }}</pre>
          </div>
        </div>
      </section>

      <section class="card">
        <h2>Klik wiersz → multi-target (session-set + navigate)</h2>
        <p class="muted">PortTarget na <code>data-table.rowClick</code>:</p>
        <pre>{{ rowClickTargetsJson }}</pre>
        <p class="muted">Klik wiersz wyzej zeby zobaczyc efekt — sesja sie zmienia, navigate trafia do logu.</p>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; font-family: system-ui, sans-serif; color: #e5e7eb; background: #0b1120; min-height: 100vh; }
    .page { max-width: 1200px; margin: 0 auto; padding: 24px; }
    h1 { color: #58a6ff; margin: 0 0 8px; }
    h2 { color: #58a6ff; font-size: 14px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    p { color: #9ca3af; line-height: 1.5; }
    p.muted { font-size: 11px; color: #6b7280; }
    code { background: #1f2937; color: #e5e7eb; padding: 2px 6px; border-radius: 3px; font-family: ui-monospace, monospace; font-size: 11px; }
    .grid { display: grid; grid-template-columns: 1fr 2fr; gap: 16px; margin: 16px 0; }
    .card { background: #0f172a; border: 1px solid #1f2937; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
    .filters { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
    .filters label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #9ca3af; }
    .filters input, .filters select { background: #0b1120; border: 1px solid #374151; color: #e5e7eb; padding: 6px 10px; border-radius: 4px; font-family: inherit; font-size: 13px; }
    .filters button { background: #1f2937; border: 1px solid #374151; color: #e5e7eb; padding: 6px 16px; border-radius: 4px; cursor: pointer; }
    .filters button:hover { background: #374151; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #1f2937; }
    th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; }
    tr { cursor: pointer; }
    tr:hover td { background: color-mix(in srgb, #58a6ff 10%, transparent); }
    td.empty { text-align: center; color: #6b7280; font-style: italic; }
    pre { background: #0b1120; border: 1px solid #1f2937; padding: 8px; border-radius: 4px; font-size: 11px; white-space: pre-wrap; max-height: 200px; overflow: auto; color: #c9d1d9; }
    .state-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    strong { color: #58a6ff; font-size: 12px; display: block; margin-bottom: 4px; }
    em { color: #6b7280; font-size: 11px; font-weight: normal; }
  `],
})
export class PortFlowDemoComponent {
  // ─── State (signals symulujace DataBus + Session) ───
  readonly allRows = signal(SEED_CLIENTS);
  readonly formName = signal('');
  readonly formSegment = signal('');
  readonly formStatus = signal('');

  // Sesja procesu — zwykle zarzadzana przez SessionStore w runtime.
  readonly session = signal<Record<string, unknown>>({});
  readonly navLog = signal<string[]>([]);

  // ─── PortSource: data-table.rows — transform z DS i session ───
  readonly filterFormSource: PortSource = {
    kind: 'session',
    field: 'filters',
  };

  readonly tableRowsSource: PortSource = {
    kind: 'transform',
    fnRef: 'filter',
    from: {
      input:     { kind: 'datasource', id: 'clients' },
      predicate: { kind: 'session',    field: 'filters' },
    },
  };

  // Resolver context — zbudowany z biezacych signalow
  readonly resolverCtx = computed<PortResolverContext>(() => ({
    datasources: {
      clients: this.allRows(),
      filters: { name: this.formName(), segment: this.formSegment(), status: this.formStatus() },
    },
    session: this.session(),
  }));

  // ─── Resolve: rows do tabeli ───
  readonly filteredRows = computed(() => {
    // synchronizuj formData → session.filters (w real runtime — przez wireUp;
    // tu dla demo: pisze sesje recznie zeby data-table mogl przeczytac przez 'session' source)
    const formData = { name: this.formName(), segment: this.formSegment(), status: this.formStatus() };
    const ctx: PortResolverContext = {
      ...this.resolverCtx(),
      session: { ...this.session(), filters: formData },
    };
    const result = resolvePortSourceSnapshot(this.tableRowsSource, ctx);
    return Array.isArray(result) ? (result as ReadonlyArray<typeof SEED_CLIENTS[0]>) : [];
  });

  // ─── PortTarget: lista akcji na klik wiersza ───
  readonly rowClickTargets: ReadonlyArray<PortTarget> = [
    { kind: 'session-set', field: 'selectedClient' },
    { kind: 'session-set', field: 'selectedClientId', valuePath: '.id' },
    { kind: 'navigate',    to: '/draft/page-clients-detail' },
  ];

  // ─── Effects (in real runtime — DataBus + Router; tu signaly) ───
  readonly effects: PortTargetEffects = {
    setSession: (field, value) => this.session.update((s) => ({ ...s, [field]: value })),
    clearSession: (field) => this.session.update((s) => { const next = { ...s }; delete next[field]; return next; }),
    setDatasource: () => { /* noop in demo */ },
    navigate: (to) => this.navLog.update((log) => [...log, `→ ${to} @ ${new Date().toLocaleTimeString()}`]),
    callService: () => { /* noop in demo */ },
    emit: () => { /* noop in demo */ },
  };

  rowClick(row: typeof SEED_CLIENTS[0]): void {
    executePortTargets(this.rowClickTargets, row, this.effects, this.session());
  }

  reset(): void {
    this.formName.set(''); this.formSegment.set(''); this.formStatus.set('');
    this.session.set({}); this.navLog.set([]);
  }

  // ─── JSON renderery (dla pokazania w UI) ───
  readonly filterFormSourceJson = computed(() => JSON.stringify(this.filterFormSource));
  readonly allRowsJson = computed(() => JSON.stringify(this.allRows().slice(0, 2), null, 2) + '\n... (+4)');
  readonly filtersJson = computed(() => JSON.stringify({ name: this.formName(), segment: this.formSegment(), status: this.formStatus() }, null, 2));
  readonly sessionJson = computed(() => JSON.stringify(this.session(), null, 2) || '{}');
  readonly rowClickTargetsJson = JSON.stringify(this.rowClickTargets, null, 2);
  readonly depsJson = computed(() => {
    const deps = listSourceDependencies(this.tableRowsSource);
    return JSON.stringify(deps);
  });
}
