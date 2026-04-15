/**
 * Lista synthetic PureFunctions wygenerowanych przez `expandAggregate(...)` na
 * modelach z `@Aggregate`. Zawiera merge fn + każdy paramsMap fn dla chained sources.
 */
import { clientFullViewAgg } from '../models/client-full-view.model';

export const aggregateFunctions = [
  ...clientFullViewAgg.functions,
];

// eslint-disable-next-line no-console
console.log('[aggregate-functions]', clientFullViewAgg.functions.map((f) => (f as { name?: string }).name ?? '?'),
  'targetDsId:', clientFullViewAgg.targetDsId,
  'sourceIds:', clientFullViewAgg.sourceIds,
);
