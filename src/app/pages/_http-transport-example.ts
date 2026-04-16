/**
 * PRZYKŁAD — jak używać HTTP transportu + onSuccess / onError w page builder.
 *
 * Ten plik NIE jest importowany przez aplikację — to dokumentacja wzorców.
 * Skopiuj fragmenty do właściwego page config.
 */

/*
 * ─── 1. Podmiana transportu w app.config.ts ───────────────────────────────
 *
 * import { HttpTransportAdapter } from './bootstrap/http-transport';
 *
 * provideEchelon({
 *   transport: new HttpTransportAdapter({
 *     baseUrl: '/api',           // proxy w angular.json lub bezpośredni URL backendu
 *     defaultHeaders: {
 *       'Authorization': `Bearer ${localStorage.getItem('token') ?? ''}`,
 *     },
 *     channelMap: {
 *       'client-by-id':  { method: 'GET',   path: '/clients/:id' },
 *       'client-update': { method: 'PATCH',  path: '/clients/:id', useBody: true },
 *       'client-delete': { method: 'DELETE', path: '/clients/:id' },
 *       'tx-create':     { method: 'POST',   path: '/transactions', useBody: true },
 *       'user-create':   { method: 'POST',   path: '/clients/:clientId/users', useBody: true },
 *       'user-delete':   { method: 'DELETE', path: '/clients/:clientId/users/:id2Key' },
 *     },
 *   }),
 *   ...
 * })
 *
 *
 * ─── 2. fetch z onSuccess + onError w handler ─────────────────────────────
 *
 * PageBuilder.create('my-page')
 *   .local('saveStatus', null)   // 'ok' | 'error' | null
 *   .local('saveError',  null)   // string | null
 *
 *   .handler('form.save', [
 *     {
 *       fetch: 'client-update',
 *       into:  'savedClient',
 *       with:  '$event',          // cały payload eventu jako body / params
 *
 *       // Wykonywane gdy HTTP 2xx i JSON się sparsował:
 *       onSuccess: [
 *         { setDatasource: 'saveStatus', from: 'static:ok' },
 *         { navigate: ['/clients'] },            // opcjonalne — redirect po sukcesie
 *       ],
 *
 *       // Wykonywane gdy HTTP error lub sieć rzuciła wyjątek:
 *       onError: [
 *         { setDatasource: 'saveStatus', from: 'static:error' },
 *         { setDatasource: 'saveError',  from: '$event.message' }, // $event = { message, channel }
 *       ],
 *     } as never,
 *   ])
 *
 *   // Widget może bindować 'saveStatus' i 'saveError' do wyświetlenia feedbacku
 *   .widget('status', { x: 0, y: 2, w: 12 }, widget.any('info-card', {
 *     bind: { value: 'saveStatus', subtitle: 'saveError' },
 *     options: { label: 'Status zapisu' },
 *     when: { path: 'saveStatus', exists: true },
 *   }))
 *
 *   .build();
 *
 *
 * ─── 3. Chaining — fetch po fetch (np. create → odśwież listę) ────────────
 *
 *   .handler('form.submit', [
 *     {
 *       fetch: 'tx-create',
 *       into:  'newTx',
 *       with:  '$event',
 *       onSuccess: [
 *         // Drugi fetch po sukcesie pierwszego; $event = resp z tx-create
 *         { fetch: 'fxTransactions', into: 'fxTransactions', with: { clientId: '$ds.routeParams.entityId' } },
 *         { navigate: ['/clients', '$ds.routeParams.entityId', 'transactions-fx'] },
 *       ],
 *       onError: [
 *         { setDatasource: 'formError', from: '$event.message' },
 *       ],
 *     } as never,
 *   ])
 *
 *
 * ─── 4. Mieszany tryb: mock dla dev, HTTP dla prod ─────────────────────────
 *
 * const transport = environment.production
 *   ? new HttpTransportAdapter({ baseUrl: environment.apiUrl })
 *   : new MockTransportAdapter({ clock: ..., fixture: { endpoints } });
 *
 * provideEchelon({ transport, ... })
 */

export {};   // żeby TS traktował plik jako moduł
