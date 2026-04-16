import { EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EchelonWidget } from '@echelon-framework/runtime';

export interface Client {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly segment: string;
  readonly limit: number;
}

@EchelonWidget({
  manifest: {
    type: 'client-list',
    version: '1.0.0',
    category: 'crm',
    description: 'Lista klientów z polem szukania + emisja wybranego klienta.',
    inputs: [
      { name: 'clients', type: 'Client[]', required: true },
      { name: 'query', type: 'string' },
    ],
    outputs: [
      { name: 'queryChange', eventType: 'client.query.changed' },
      { name: 'select',      eventType: 'client.selected' },
    ],
    actions: [],
    capabilities: { eventBus: 'emit', dataBus: 'read' },
    testability: { interactions: [{action:'search'},{action:'select'}], observables: ['clients'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-client-list',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="wrap" data-testid="widget-client-list" data-echelon-state="ready">
      <input type="text" [ngModel]="query" (ngModelChange)="emitQuery($event)"
             placeholder="Search by name or code…" class="search" />
      <ul>
        @for (c of clients; track c.id) {
          <li (click)="select.emit(c)" data-testid="client-row">
            <div class="row1">
              <strong>{{ c.code }}</strong>
              <span class="seg">{{ c.segment }}</span>
            </div>
            <div class="row2">{{ c.name }}</div>
            <div class="row3">Limit: {{ formatLimit(c.limit) }}</div>
          </li>
        } @empty {
          <li class="empty">No clients</li>
        }
      </ul>
    </div>
  `,
  styles: [`
    .wrap { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
    .search { width: 100%; margin-bottom: 10px; }
    ul { list-style: none; margin: 0; padding: 0; max-height: 480px; overflow-y: auto; }
    li { padding: 10px 12px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 6px; cursor: pointer; }
    li:hover { background: rgba(88,166,255,0.06); border-color: var(--accent); }
    li.empty { color: var(--muted); cursor: default; text-align: center; }
    .row1 { display: flex; justify-content: space-between; }
    .seg { color: var(--muted); font-size: 11px; text-transform: uppercase; }
    .row2 { font-size: 13px; margin-top: 2px; }
    .row3 { color: var(--muted); font-size: 11px; margin-top: 2px; font-family: ui-monospace, monospace; }
  `],
})
export class ClientCardComponent {
  @Input() clients: ReadonlyArray<Client> = [];
  @Input() query = '';

  @Output() readonly queryChange = new EventEmitter<string>();
  @Output() readonly select = new EventEmitter<Client>();

  emitQuery(v: string): void { this.queryChange.emit(v); }

  formatLimit(v: number): string {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v) + ' PLN';
  }
}
