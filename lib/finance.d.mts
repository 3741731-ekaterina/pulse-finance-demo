export type Transaction={id:string;date:string;month:string;value:number;group:string;dealId:string;deal:string;cityId:string;city:string;partnerId:string;partner:string;categoryId:string;category:string;currency:string;description:string};
export type ReportRow={id:string;label:string;kind:string;values:number[];ids:string[];children:ReportRow[]};
export function monthRange(end:string):string[];
export function monthlyChange(value:number,previous:number|null|undefined):{difference:number;percent:number|null;direction:'up'|'down'|'same'}|null;
export function aggregate(rows:Transaction[],months:string[],options?:{city?:string;company?:string|string[];currency?:string;general?:string[];incomeView?:'customer'|'object';sort?:'amount-desc'|'amount-asc'|'name-asc'|'name-desc'}):{tree:ReportRow[];selected:Transaction[];income:number[];expense:number[];net:number[];unassigned:number;outside:number};
export function demoData():{rows:Transaction[];skipped:number;loadedAt:string;through:string;demo:boolean};

export function expensePurpose(t:Transaction):"admin"|"objects"|"taxes"|"financial";
