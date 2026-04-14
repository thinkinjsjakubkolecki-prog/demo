import { PureFunction } from '@echelon-framework/runtime';
import type { FxPosition } from '../widgets/position-row.component';

interface SpotMark { readonly bid?: number; readonly ask?: number; }

@PureFunction({
  description: 'Aggregate live P&L across all open positions in PLN.',
  inputs: [
    { name: 'positions', type: 'FxPosition[]' },
    { name: 'mark',      type: '{bid,ask}|number' },
  ],
  output: { type: 'string' },
})
export class PositionsTotalPnl {
  static fn(positions: ReadonlyArray<FxPosition>, mark: SpotMark | number | null): string {
    if (positions.length === 0) { return '—'; }
    let m: number | null = null;
    if (typeof mark === 'number') { m = mark; }
    else if (mark !== null && typeof mark.bid === 'number' && typeof mark.ask === 'number') {
      m = (mark.bid + mark.ask) / 2;
    }
    if (m === null) { return '—'; }
    const pnl = positions.reduce(
      (acc, p) => acc + (m! - p.entryRate) * p.qty * (p.side === 'buy' ? 1 : -1),
      0,
    );
    return `${pnl >= 0 ? '+' : ''}${pnl.toFixed(0)} PLN`;
  }
}
