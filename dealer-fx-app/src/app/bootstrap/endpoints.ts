/**
 * Endpoint handlers — używane przez mock transport.
 * Każdy klucz = `channel` w fetch action; wartość = funkcja
 * `(params, ctx) => data`.
 */

export const endpoints = {
  /** Resolver pojedynczego klienta po `code` z fixture. */
  'client-by-id': async (params: Record<string, unknown>): Promise<unknown> => {
    const code = String(params['id'] ?? '');
    const res = await fetch('/assets/fixtures/clients.json');
    const all = (await res.json()) as Array<Record<string, unknown>>;
    return all.find((c) => c['code'] === code) ?? null;
  },
};
