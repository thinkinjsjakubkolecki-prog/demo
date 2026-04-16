import { PureFunction } from '@echelon-framework/runtime';

@PureFunction({
  name: 'findClientByCode',
  description: 'Znajduje klienta z listy po polu `code` używając routeParams.entityId.',
  inputs: [
    { name: 'rows',   type: 'object[]' },
    { name: 'params', type: 'Record<string,string>' },
  ],
  output: { type: 'object | null' },
})
export class FindClientByCode {
  static fn(
    rows: ReadonlyArray<Record<string, unknown>> | null | undefined,
    params: Record<string, string> | null | undefined,
  ): Record<string, unknown> | null {
    const id = params?.['entityId'];
    if (!rows || id === undefined || id === '') { return null; }
    return rows.find((r) => r['code'] === id) ?? null;
  }
}
