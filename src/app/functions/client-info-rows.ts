/**
 * `clientInfoRows` — pure fn renderująca rekord klienta jako key/value listę
 * używając metadanych z `ClientModel`. Apka deklaruje listę pól, framework
 * podstawia label/format z `@Field`.
 *
 * Pokazuje wzorzec: model-driven UI bez powielania labeli/formatów w configu strony.
 */
import { PureFunction } from '@echelon-framework/runtime';
import { infoRowsFromModel } from '@echelon-framework/model';
import { ClientModel } from '../models/client.model';

const INFO_FIELDS = [
  'entity', 'custom', 'codeId', 'status', 'customerType',
  'customerRatingSegment', 'customerRatingGroup', 'email', 'natio',
] as const;

const LIMITS_FIELDS = [
  'accountManager', 'branch', 'csCode', 'capDate',
  'limitExpirationDate', 'limitReportFrequency',
] as const;

@PureFunction({
  name: 'clientInfoRows',
  description: 'Generuje listę {k,v} dla tab Info na bazie ClientModel @Field metadat.',
  inputs: [{ name: 'record', type: 'object | null' }],
  output: { type: 'object[]' },
})
export class ClientInfoRows {
  static fn(record: Record<string, unknown> | null | undefined): ReadonlyArray<{ k: string; v: string }> {
    return infoRowsFromModel(ClientModel, record, [...INFO_FIELDS]);
  }
}

@PureFunction({
  name: 'clientLimitsRows',
  description: 'Generuje listę {k,v} sekcji Limity i opiekun na bazie ClientModel.',
  inputs: [{ name: 'record', type: 'object | null' }],
  output: { type: 'object[]' },
})
export class ClientLimitsRows {
  static fn(record: Record<string, unknown> | null | undefined): ReadonlyArray<{ k: string; v: string }> {
    if (!record) { return []; }
    const dealer = record['dealer'] as { firstName?: string; lastName?: string; adname?: string } | undefined;
    const out: Array<{ k: string; v: string }> = [];
    if (dealer !== undefined) {
      out.push({ k: 'Dealer', v: `${dealer.firstName ?? ''} ${dealer.lastName ?? ''} (${dealer.adname ?? ''})`.trim() });
    }
    return [...out, ...infoRowsFromModel(ClientModel, record, [...LIMITS_FIELDS])];
  }
}
