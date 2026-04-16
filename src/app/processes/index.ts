import { rfqProcess } from './rfq-process.js';
import { positionCloseProcess } from './position-close-process.js';
import type { BusinessProcess } from './types.js';

export const businessProcesses: ReadonlyArray<BusinessProcess> = [rfqProcess, positionCloseProcess];

export * from './types.js';
export { rfqProcess, positionCloseProcess };
