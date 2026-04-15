import { PureFunction } from '@echelon-framework/runtime';

type Row = Record<string, unknown>;

@PureFunction({
  description: 'Dodaje pole `lp` (1-based index) do każdego wiersza + composite `peselOrRegon` (pesel jeśli obecny, inaczej regon).',
  inputs: [{ name: 'rows', type: 'object[]' }],
  output: { type: 'object[]' },
})
export class AddLp {
  static fn(rows: ReadonlyArray<Row>): ReadonlyArray<Row> {
    if (!rows) { return []; }
    return rows.map((r, i) => {
      const pesel = String(r['pesel'] ?? '').trim();
      const regon = String(r['regon'] ?? '').trim();
      const hasPesel = pesel !== '' && pesel !== '—';
      const hasRegon = regon !== '' && regon !== '—';
      return {
        ...r,
        lp: i + 1,
        peselOrRegon: hasPesel ? pesel : hasRegon ? regon : '—',
      };
    });
  }
}
