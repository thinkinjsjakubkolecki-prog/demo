import { PureFunction } from '@echelon-framework/runtime';

@PureFunction({
  description: 'Generic per-field search — każdy klucz w filters matchuje ten sam klucz w wierszu (contains, case-insensitive). Specjalny klucz "q" = full-text po wszystkich polach.',
  inputs: [
    { name: 'rows',    type: 'object[]' },
    { name: 'filters', type: 'Record<string,unknown>' },
  ],
  output: { type: 'object[]' },
})
export class SearchRows {
  static fn(
    rows: ReadonlyArray<Record<string, unknown>>,
    filters: Record<string, unknown> | null,
  ): ReadonlyArray<Record<string, unknown>> {
    if (!rows) { return []; }
    if (!filters) { return rows; }
    const norm = (v: unknown): string => String(v ?? '').toLowerCase().trim();
    const entries = Object.entries(filters)
      .map(([k, v]) => [k, norm(v)] as const)
      .filter(([, v]) => v !== '');
    if (entries.length === 0) { return rows; }
    return rows.filter((row) =>
      entries.every(([key, needle]) => {
        if (key === 'q') {
          return Object.values(row).some((v) => norm(v).includes(needle));
        }
        return norm(row[key]).includes(needle);
      }),
    );
  }
}
