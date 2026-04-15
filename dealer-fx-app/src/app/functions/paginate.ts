import { PureFunction } from '@echelon-framework/runtime';

@PureFunction({
  name: 'paginate',
  description: 'Slice an array into a single page given (page, pageSize).',
  inputs: [
    { name: 'rows', type: 'unknown[]' },
    { name: 'page', type: 'number' },
    { name: 'pageSize', type: 'number' },
  ],
  output: { type: 'unknown[]' },
})
export class Paginate {
  static fn(rows: ReadonlyArray<unknown>, page: number, pageSize: number): ReadonlyArray<unknown> {
    if (!rows) { return []; }
    const p = Math.max(1, page || 1);
    const sz = Math.max(1, pageSize || 10);
    const start = (p - 1) * sz;
    return rows.slice(start, start + sz);
  }
}

@PureFunction({
  name: 'totalPages',
  description: 'Compute total page count given (totalRows, pageSize).',
  inputs: [
    { name: 'rows', type: 'unknown[]' },
    { name: 'pageSize', type: 'number' },
  ],
  output: { type: 'number' },
})
export class TotalPages {
  static fn(rows: ReadonlyArray<unknown>, pageSize: number): number {
    const sz = Math.max(1, pageSize || 10);
    return Math.max(1, Math.ceil((rows?.length ?? 0) / sz));
  }
}
