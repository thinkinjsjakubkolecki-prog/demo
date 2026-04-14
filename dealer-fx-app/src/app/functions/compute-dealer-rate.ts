import { PureFunction } from '@echelon-framework/runtime';

interface SpotMark { readonly bid?: number; readonly ask?: number; }
type Side = 'BUY' | 'SELL';

@PureFunction({
  description: 'Compute client rate from spot + side + dealer margin in pips.',
  inputs: [
    { name: 'spot',       type: '{bid,ask}' },
    { name: 'side',       type: 'BUY|SELL' },
    { name: 'marginPips', type: 'number' },
  ],
  output: { type: 'number' },
})
export class ComputeDealerRate {
  static fn(spot: SpotMark | null, side: Side, marginPips: number): number {
    const s = spot ?? {};
    const bid = typeof s.bid === 'number' ? s.bid : 0;
    const ask = typeof s.ask === 'number' ? s.ask : 0;
    const margin = (typeof marginPips === 'number' ? marginPips : 0) * 0.0001;
    const isBuy = side === 'BUY';
    const base = isBuy ? ask : bid;
    return +(base + (isBuy ? margin : -margin)).toFixed(5);
  }
}
