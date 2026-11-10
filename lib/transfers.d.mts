export const owners:Record<string,string>;
export type Transfer={fromCompanyId?:string;toCompanyId?:string;fromCompany?:string;toCompany?:string;sourceVat?:number|null;id:string;date:string;month:string;value:number;received:number|null;fromId:string;toId:string;fromAccount:string;toAccount:string;fromOwner:string;toOwner:string;currency:string;toCurrency:string;description:string};
export type TransferRoute={id:string;from:string;to:string;rows:Transfer[];values:number[]};
export type TransferReport={routes:TransferRoute[];rows:Transfer[];excluded:Transfer[];within:Transfer[];suspectIds:Set<string>;totals:number[]};
export function accountOwner(name:string):string;
export function normalizeTransfers(transactions:unknown[],accounts:unknown[],accountGroups?:unknown[]):Transfer[];
export function transferReport(transfers:Transfer[],months:string[],options?:{currency?:string;from?:string;to?:string;sort?:string;internal?:boolean}):TransferReport;

export function transferFingerprint(t:Transfer,rows:Transfer[]):string;
