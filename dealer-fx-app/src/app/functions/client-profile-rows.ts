/**
 * `clientProfile_<group>Rows` — pure-fns generujące key/value tabele
 * dla sekcji widoku Profil. Każda używa `infoRowsFromModel(ClientModel, ...)`
 * — labele i formaty wynikają z `@Field` w modelu.
 */
import { PureFunction } from '@echelon-framework/runtime';
import { infoRowsFromModel } from '@echelon-framework/model';
import { ClientModel } from '../models/client.model';

type R = Record<string, unknown> | null | undefined;
const rows = (rec: R, keys: ReadonlyArray<keyof ClientModel & string>) => {
  // eslint-disable-next-line no-console
  console.log('[clientProfile rows] called with rec:', rec === null ? 'NULL' : rec === undefined ? 'UNDEFINED' : Object.keys(rec).slice(0, 3), 'keys:', keys.slice(0, 3));
  return infoRowsFromModel(ClientModel, rec, [...keys]);
};

@PureFunction({ name: 'clientProfile_identifyRows', inputs: [{name:'rec',type:'object'}], output: {type:'object[]'} })
export class ClientProfileIdentifyRows { static fn(rec: R) { return rows(rec, ['code','codeId','custom']); } }

@PureFunction({ name: 'clientProfile_basicRows', inputs: [{name:'rec',type:'object'}], output: {type:'object[]'} })
export class ClientProfileBasicRows { static fn(rec: R) { return rows(rec, ['entity','status','customerType']); } }

@PureFunction({ name: 'clientProfile_classificationRows', inputs: [{name:'rec',type:'object'}], output: {type:'object[]'} })
export class ClientProfileClassificationRows { static fn(rec: R) { return rows(rec, ['region','tenorRfed','customerRatingGroup','customerRatingSegment']); } }

@PureFunction({ name: 'clientProfile_marginsRows', inputs: [{name:'rec',type:'object'}], output: {type:'object[]'} })
export class ClientProfileMarginsRows { static fn(rec: R) { return rows(rec, ['marginGroup','margin1wD','marginRollback','maxMarginEcommerce','marginSource']); } }

@PureFunction({ name: 'clientProfile_managersRows', inputs: [{name:'rec',type:'object'}], output: {type:'object[]'} })
export class ClientProfileManagersRows { static fn(rec: R) { return rows(rec, ['accountManager','specjalista','natio','email','branch','csCode']); } }

@PureFunction({ name: 'clientProfile_limitsRows', inputs: [{name:'rec',type:'object'}], output: {type:'object[]'} })
export class ClientProfileLimitsRows { static fn(rec: R) { return rows(rec, ['capDate','limitExpirationDate','limitReportFrequency']); } }

@PureFunction({ name: 'clientProfile_flagsRows', inputs: [{name:'rec',type:'object'}], output: {type:'object[]'} })
export class ClientProfileFlagsRows {
  static fn(rec: R) {
    return rows(rec, [
      'systemAccess','blockGlobalMargin','mol','fxSecured',
      'marginAum','useExperimentalMargin','aiDataShare',
      'txExpiryNotifications','swapPoints','groupRfq','swapWithoutMargin',
    ]);
  }
}

@PureFunction({ name: 'clientProfile_txAccessRows', inputs: [{name:'rec',type:'object'}], output: {type:'object[]'} })
export class ClientProfileTxAccessRows {
  static fn(rec: R) { return rows(rec, ['txTODAY','txSPOT','txFORWARD','txSWAP','txSFP','txDCD']); }
}
