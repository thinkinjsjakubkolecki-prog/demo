import { PureFunction } from '@echelon-framework/runtime';

type Row = Record<string, unknown>;
type UpdateEvent = Readonly<{ key: unknown; patch: Row }>;
type DeleteEvent = Readonly<{ key: unknown }>;

@PureFunction({
  description: 'Aplikuje patch do wiersza o zadanym kluczu (editable-table.rowUpdate). Zwraca nową tablicę.',
  inputs: [
    { name: 'rows',   type: 'object[]' },
    { name: 'event',  type: 'object' },
    { name: 'rowKey', type: 'string' },
  ],
  output: { type: 'object[]' },
})
export class MergeRow {
  static fn(rows: ReadonlyArray<Row>, event: UpdateEvent, rowKey: string): ReadonlyArray<Row> {
    if (!rows) { return []; }
    if (!event || event.key === undefined) { return rows; }
    return rows.map((r) => r[rowKey] === event.key ? { ...r, ...event.patch } : r);
  }
}

@PureFunction({
  description: 'Usuwa wiersz o zadanym kluczu (editable-table.rowDelete).',
  inputs: [
    { name: 'rows',   type: 'object[]' },
    { name: 'event',  type: 'object' },
    { name: 'rowKey', type: 'string' },
  ],
  output: { type: 'object[]' },
})
export class DeleteRow {
  static fn(rows: ReadonlyArray<Row>, event: DeleteEvent, rowKey: string): ReadonlyArray<Row> {
    if (!rows) { return []; }
    if (!event || event.key === undefined) { return rows; }
    return rows.filter((r) => r[rowKey] !== event.key);
  }
}
