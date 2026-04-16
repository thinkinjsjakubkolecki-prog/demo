import { PureFunction } from '@echelon-framework/runtime';

@PureFunction({
  name: 'count',
  description: 'Length of an array (0 if undefined/null).',
  inputs: [{ name: 'rows', type: 'unknown[]' }],
  output: { type: 'number' },
})
export class Count {
  static fn(rows: ReadonlyArray<unknown> | null | undefined): number {
    return rows?.length ?? 0;
  }
}
