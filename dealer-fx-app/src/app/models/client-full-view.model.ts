/**
 * `ClientFullView` — agregat 4 endpointów (basic + margins + accounts + dealer).
 *
 * Demonstracja `@Aggregate` z **chained sources** (option B):
 *  - `basic`, `margins`, `accounts` — root sources (apka odpala fetch z
 *    routeParams w lifecycle.onInit),
 *  - `dealer` — chained, fetch po `basic` (zaczerpnięte `dealer.adname`).
 *
 * Framework auto-generuje:
 *  - 4 source DS-y (kind: local),
 *  - synthetic computed DS dla params chained source (paramsMap → params object),
 *  - eventHandler `onDatasource: <basicParams>` triggering fetch dealera,
 *  - synthetic merge fn produkujący ostateczny aggregate.
 */
import { Model, Aggregate, Field, expandAggregate } from '@echelon-framework/model';

@Model({ name: 'ClientFullView' })
@Aggregate({
  sources: {
    basic:    { endpoint: 'client-by-id',    paramKey: 'id' },
    margins:  { endpoint: 'client-margins',  paramKey: 'clientId' },
    accounts: { endpoint: 'client-accounts', paramKey: 'clientId' },
    dealer: {
      endpoint: 'dealer-by-adname',
      dependsOn: 'basic',
      paramsMap: (basic) => {
        const b = basic as { dealer?: { adname?: string } } | null | undefined;
        return { adname: b?.dealer?.adname ?? '' };
      },
    },
  },
  merge: (basic, margins, accounts, dealer) => ({
    ...(basic   as Record<string, unknown> ?? {}),
    margins:  margins  ?? [],
    accounts: accounts ?? [],
    dealerFull: dealer ?? null,
  }),
})
export class ClientFullViewModel {
  @Field({ label: 'Nazwa' })       entity!: string;
  @Field({ label: 'Margins' })     margins!: ReadonlyArray<{ currency: string; bps: number }>;
  @Field({ label: 'Konta' })       accounts!: ReadonlyArray<{ id: string; iban: string; accountType: string; currency: string }>;
  @Field({ label: 'Dealer info' }) dealerFull!: { adname: string; firstName: string; lastName: string; email: string; phone: string } | null;
}

export const clientFullViewAgg = expandAggregate(ClientFullViewModel, { idSuffix: 'client-profile' });
