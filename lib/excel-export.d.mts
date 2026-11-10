import type {ReportRow,Transaction} from './finance.mjs';
export function comparisonFill(flow:string,value:number,previous:number|undefined):string|null;
export function reportWorkbook(options:{tree:ReportRow[];months:string[];monthLabels:string[];historyMonths:string[];historyRows:Map<string,ReportRow>;metadata:unknown[][]}):Promise<Uint8Array>;
export function paymentsWorkbook(options:{rows:Transaction[];metadata:unknown[][]}):Promise<Uint8Array>;
export function transfersWorkbook(options:{report:import('./transfers.mjs').TransferReport;monthLabels:string[];metadata:unknown[][]}):Promise<Uint8Array>;
