import { EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EchelonWidget } from '@echelon-framework/runtime';

export interface FxPosition {
  readonly id: string;
  readonly client: string;
  readonly pair: string;
  readonly side: 'buy' | 'sell';
  readonly qty: number;
  readonly entryRate: number;
}

@EchelonWidget({
  manifest: {
    type: 'positions-blotter',
    version: '1.0.0',
    category: 'fx',
    description: 'Tabela otwartych pozycji z live mark + akcją close per row.',
    inputs: [
      { name: 'positions', type: 'FxPosition[]', required: true },
      { name: 'mark', type: 'object' },
    ],
    outputs: [
      { name: 'closeRequest', eventType: 'fx.position.close' },
    ],
    actions: [],
    capabilities: { eventBus: 'emit', dataBus: 'read' },
    testability: { interactions: [{action:'close'}], observables: ['mark'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-positions-blotter',
  imports: [CommonModule],
  template: `
    <div class="wrap" data-testid="widget-positions-blotter" data-echelon-state="ready">
      <table>
        <thead>
          <tr>
            <th>Client</th><th>Pair</th><th>Side</th>
            <th class="r">Qty</th><th class="r">Entry</th><th class="r">Mark</th>
            <th class="r">P&amp;L</th><th></th>
          </tr>
        </thead>
        <tbody>
          @for (p of positions; track p.id) {
            <tr>
              <td>{{ p.client }}</td>
              <td>{{ p.pair }}</td>
              <td><span class="side" [class.buy]="p.side==='buy'" [class.sell]="p.side==='sell'">{{ p.side.toUpperCase() }}</span></td>
              <td class="r mono">{{ formatQty(p.qty) }}</td>
              <td class="r mono">{{ p.entryRate.toFixed(5) }}</td>
              <td class="r mono live">{{ markRate() === null ? '—' : markRate()!.toFixed(5) }}</td>
              <td class="r mono" [class.profit]="pnl(p)>0" [class.loss]="pnl(p)<0">{{ pnlText(p) }}</td>
              <td class="r"><button type="button" (click)="emitClose(p)" [disabled]="markRate()===null">Close</button></td>
            </tr>
          } @empty {
            <tr><td colspan="8" class="empty">No open positions</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .wrap { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 6px 8px; color: var(--muted); font-weight: 500; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid var(--border); }
    td { padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04); }
    th.r, td.r { text-align: right; }
    .mono { font-family: ui-monospace, monospace; }
    .live { color: var(--accent); }
    .profit { color: var(--buy); }
    .loss { color: var(--sell); }
    .side { padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 700; }
    .side.buy { background: rgba(63,185,80,0.18); color: var(--buy); }
    .side.sell { background: rgba(248,81,73,0.18); color: var(--sell); }
    .empty { text-align: center; color: var(--muted); padding: 20px; }
    button { padding: 4px 10px; border: 1px solid var(--accent); background: transparent; color: var(--accent); border-radius: 4px; }
    button:disabled { border-color: var(--border); color: var(--muted); cursor: not-allowed; }
    button:hover:not(:disabled) { background: var(--accent); color: var(--bg); }
  `],
})
export class PositionRowComponent {
  @Input() positions: ReadonlyArray<FxPosition> = [];
  @Input() mark: { bid?: number; ask?: number } | null = null;

  @Output() readonly closeRequest = new EventEmitter<{
    positionId: string; mark: number; side: string;
  }>();

  markRate(): number | null {
    if (this.mark === null) { return null; }
    const b = this.mark.bid; const a = this.mark.ask;
    if (typeof b === 'number' && typeof a === 'number') { return (a + b) / 2; }
    return null;
  }
  pnl(p: FxPosition): number {
    const m = this.markRate(); if (m === null) { return 0; }
    return (m - p.entryRate) * p.qty * (p.side === 'buy' ? 1 : -1);
  }
  pnlText(p: FxPosition): string {
    const m = this.markRate(); if (m === null) { return '—'; }
    const v = this.pnl(p);
    return `${v >= 0 ? '+' : ''}${v.toFixed(0)} PLN`;
  }
  formatQty(q: number): string { return new Intl.NumberFormat('en-US').format(q); }
  emitClose(p: FxPosition): void {
    const m = this.markRate(); if (m === null) { return; }
    this.closeRequest.emit({ positionId: p.id, mark: m, side: p.side });
  }
}
