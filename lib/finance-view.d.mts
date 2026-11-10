import type {Transaction,ReportRow} from './finance.mjs';
import type {TaxPeriod} from './tax-matrix.mjs';
export function financeView(rows:Transaction[],from:string,to:string,group:string,options?:Parameters<typeof import('./finance.mjs').aggregate>[2]):{periods:TaxPeriod[];tree:ReportRow[];selected:Transaction[];income:number[];expense:number[];net:number[];unassigned:number;outside:number};
