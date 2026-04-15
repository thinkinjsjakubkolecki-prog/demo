/**
 * Barrel — zbiera wszystkie klasy oznaczone dekoratorami `@PureFunction` /
 * `@Validator` / `@Formatter` / `@Predicate`.
 *
 * Bootstrap: `provideEchelon({ functions: Object.values(fns), ... })`.
 */
export * from './filter-clients';
export * from './paginate';
export * from './positions-total-pnl';
export * from './compute-dealer-rate';
export * from './validate-amount';
export * from './format-pln';
export * from './merge-row';
export * from './search-rows';
export * from './add-lp';
export * from './count';
export * from './pick-by-id';
