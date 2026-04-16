import { Formatter } from '@echelon-framework/runtime';

/**
 * Formatuje liczbę jako wartość PLN. Decorator-style.
 */
@Formatter({
  description: 'Format number as PLN currency string ("1,234,567.89 PLN").',
  inputs: [{ name: 'value', type: 'number' }],
  output: { type: 'string' },
})
export class FormatPln {
  static fn(value: number): string {
    if (!Number.isFinite(value)) { return '—'; }
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(value) + ' PLN';
  }
}
