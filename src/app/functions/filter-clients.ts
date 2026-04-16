import { PureFunction } from '@echelon-framework/runtime';

interface AdminClient {
  readonly code: string;
  readonly name: string;
  readonly pesel: string;
  readonly nip: string;
  readonly status: string;
}

@PureFunction({
  description: 'Filtruje klientów po wszystkich polach filter-form (status/code/name/pesel/nip).',
  inputs: [
    { name: 'clients', type: 'AdminClient[]' },
    { name: 'filters', type: 'Record<string,unknown>' },
  ],
  output: { type: 'AdminClient[]' },
})
export class FilterClients {
  static fn(
    clients: ReadonlyArray<AdminClient>,
    filters: Record<string, unknown> | null,
  ): ReadonlyArray<AdminClient> {
    if (!clients) { return []; }
    if (!filters) { return clients; }
    const get = (k: string): string => String(filters[k] ?? '').toLowerCase().trim();
    const status = get('status');
    const code   = get('code');
    const name   = get('name');
    const pesel  = get('pesel');
    const nip    = get('nip');
    return clients.filter((c) => {
      if (status !== '' && c.status.toLowerCase() !== status) { return false; }
      if (code   !== '' && !c.code.toLowerCase().includes(code))   { return false; }
      if (name   !== '' && !c.name.toLowerCase().includes(name))   { return false; }
      if (pesel  !== '' && !c.pesel.toLowerCase().includes(pesel)) { return false; }
      if (nip    !== '' && !c.nip.toLowerCase().includes(nip))     { return false; }
      return true;
    });
  }
}
