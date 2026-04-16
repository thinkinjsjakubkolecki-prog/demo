import { EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EchelonWidget } from '@echelon-framework/runtime';

/**
 * Formularz RFQ (Request For Quote) — dealer wprowadza wybór klienta,
 * stronę (BUY/SELL), kwotę i marżę. Emituje `submit` z payloadem
 * gotowym do `callComputed: "computeDealerRate"`.
 */
@EchelonWidget({
  manifest: {
    type: 'dealer-quote-form',
    version: '1.0.0',
    category: 'fx',
    description: 'Formularz RFQ — dealer ustawia params i emituje request kwotacji.',
    inputs: [
      { name: 'clientCode', type: 'string' },
      { name: 'spot', type: 'object' },
    ],
    outputs: [
      { name: 'submit', eventType: 'fx.quote.requested' },
      { name: 'reset',  eventType: 'fx.quote.reset' },
    ],
    actions: [],
    capabilities: { eventBus: 'emit', dataBus: 'read' },
    testability: { interactions: [{action:'submit'},{action:'reset'}], observables: ['spot'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-dealer-quote-form',
  imports: [CommonModule, FormsModule],
  template: `
    <form (submit)="onSubmit($event)" class="form" data-testid="widget-dealer-quote-form" data-echelon-state="ready">
      <h3>RFQ — USD/PLN</h3>
      <div class="row">
        <label>Client</label>
        <input type="text" [value]="clientCode || ''" disabled placeholder="(select from list)"/>
      </div>
      <div class="row">
        <label>Spot bid / ask</label>
        <div class="spot">{{ spot?.bid?.toFixed(5) ?? '—' }} / {{ spot?.ask?.toFixed(5) ?? '—' }}</div>
      </div>
      <div class="row">
        <label>Side</label>
        <div class="side-pick">
          <label><input type="radio" [(ngModel)]="side" name="side" value="BUY"/> BUY</label>
          <label><input type="radio" [(ngModel)]="side" name="side" value="SELL"/> SELL</label>
        </div>
      </div>
      <div class="row">
        <label>Amount (USD)</label>
        <input type="number" [(ngModel)]="amount" name="amount" min="1000" step="1000" required/>
      </div>
      <div class="row">
        <label>Margin (pips)</label>
        <input type="number" [(ngModel)]="marginPips" name="margin" min="0" max="200" step="1"/>
      </div>
      <div class="actions">
        <button type="button" (click)="onReset()">Reset</button>
        <button type="submit" [disabled]="!canSubmit()">Send quote</button>
      </div>
    </form>
  `,
  styles: [`
    .form { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
    h3 { margin: 0 0 12px; font-size: 14px; color: var(--accent); }
    .row { display: grid; grid-template-columns: 130px 1fr; gap: 8px; align-items: center; margin-bottom: 10px; }
    label { color: var(--muted); font-size: 12px; }
    .spot { font-family: ui-monospace, monospace; color: var(--accent); }
    .side-pick { display: flex; gap: 16px; }
    .side-pick label { color: var(--fg); display: flex; align-items: center; gap: 4px; }
    input[type="number"], input[type="text"] { width: 100%; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    button { padding: 8px 14px; border-radius: 4px; border: 1px solid var(--border); background: var(--panel); color: var(--fg); }
    button[type="submit"] { background: var(--accent); color: var(--bg); border-color: var(--accent); font-weight: 600; }
    button[type="submit"]:disabled { background: var(--border); color: var(--muted); cursor: not-allowed; }
  `],
})
export class DealerQuoteFormComponent {
  @Input() clientCode = '';
  @Input() spot: { bid?: number; ask?: number } | null = null;

  side: 'BUY' | 'SELL' = 'BUY';
  amount = 100_000;
  marginPips = 50;

  @Output() readonly submit = new EventEmitter<{
    client: string; side: 'BUY' | 'SELL'; amount: number; marginPips: number;
    spot: { bid?: number; ask?: number } | null;
  }>();
  @Output() readonly reset = new EventEmitter<void>();

  canSubmit(): boolean {
    return this.clientCode !== '' && this.amount >= 1000 && this.spot !== null;
  }

  onSubmit(e: Event): void {
    e.preventDefault();
    if (!this.canSubmit()) { return; }
    this.submit.emit({
      client: this.clientCode, side: this.side, amount: this.amount,
      marginPips: this.marginPips, spot: this.spot,
    });
  }

  onReset(): void {
    this.side = 'BUY'; this.amount = 100_000; this.marginPips = 50;
    this.reset.emit();
  }
}
