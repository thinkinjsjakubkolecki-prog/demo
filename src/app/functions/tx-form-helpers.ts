/**
 * Pure functions dla strony Nowa Transakcja (/new-transaction/:entityId/:txType).
 * Wejście: `routeParams` (z DS 'routeParams') zawiera `txType` (np. 'fx', 'swap').
 * Wyjście: lista pól / sekcji / etykieta — dynamicznie wg txType.
 */
import { PureFunction } from '@echelon-framework/runtime';
import { TX_TYPES, sectionsOf, type TxField } from '../pages/client-profile/tx-types';
import type { FormFieldDef, FormSectionDef } from '@echelon-framework/widgets-core';

type RouteParams = { txType?: string } | null | undefined;

@PureFunction({
  name: 'txFieldsForType',
  description: 'Zwraca definicje pól formularza dla danego txType z routeParams.',
  inputs: [{ name: 'routeParams', type: 'object' }],
  output: { type: 'object[]' },
})
export class TxFieldsForType {
  static fn(routeParams: RouteParams): ReadonlyArray<FormFieldDef> {
    const spec = TX_TYPES.find((t) => t.id === (routeParams?.txType ?? ''));
    if (spec === undefined) { return []; }
    return spec.fields.map((f: TxField) => ({
      id:      f.id,
      label:   f.label,
      type:    f.type as FormFieldDef['type'],
      section: f.section,
      width:   f.width ?? 6,
      ...(f.options !== undefined ? { options: f.options } : {}),
    }));
  }
}

@PureFunction({
  name: 'txSectionsForType',
  description: 'Zwraca definicje sekcji formularza dla danego txType z routeParams.',
  inputs: [{ name: 'routeParams', type: 'object' }],
  output: { type: 'object[]' },
})
export class TxSectionsForType {
  static fn(routeParams: RouteParams): ReadonlyArray<FormSectionDef> {
    const spec = TX_TYPES.find((t) => t.id === (routeParams?.txType ?? ''));
    if (spec === undefined) { return []; }
    return sectionsOf(spec.fields).map((s) => ({
      id:         s.id,
      title:      s.title,
      collapsible: s.collapsible,
    }));
  }
}

@PureFunction({
  name: 'txLabelForType',
  description: 'Zwraca etykietę (display name) dla danego txType z routeParams.',
  inputs: [{ name: 'routeParams', type: 'object' }],
  output: { type: 'string' },
})
export class TxLabelForType {
  static fn(routeParams: RouteParams): string {
    return TX_TYPES.find((t) => t.id === (routeParams?.txType ?? ''))?.label ?? 'Nowa transakcja';
  }
}
