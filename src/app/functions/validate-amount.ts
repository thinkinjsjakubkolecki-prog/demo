import { Validator } from '@echelon-framework/runtime';

/**
 * Walidacja kwoty FX — między 1k a 50M USD.
 * Demonstruje styl dekoratora — funkcja jako klasa z `static fn`.
 * (Alternatywa do `defineFunction(...)` — równoważne semantycznie.)
 */
@Validator({
  description: 'Reject FX amounts outside [1000, 50_000_000] USD.',
  inputs: [{ name: 'value', type: 'number' }],
  output: { type: 'string|null' },
})
export class ValidateAmount {
  static fn(value: number): string | null {
    if (!Number.isFinite(value)) { return 'Amount must be a number'; }
    if (value < 1_000)            { return 'Amount must be ≥ 1,000 USD'; }
    if (value > 50_000_000)       { return 'Amount must be ≤ 50,000,000 USD'; }
    return null;
  }
}
