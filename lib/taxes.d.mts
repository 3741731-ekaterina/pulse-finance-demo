export function cents(n:number):number;
export function isoDate(d:string):string;
export function fingerprint(t:any):string;
export function analyze(t:any):any;
export function reviewed(t:any,entry:any):any;
export function periodKey(date:string,group:string):string;

export function taxEligible(t:any):boolean;
export function intercompanyPayments(t:any[]):any[];
export function customerReceipt(t:any):boolean;
export function vatBreakdown(rows:any[]):Array<{label:string;rate:number|null;vat:number;unknown:number}>;

export function vatReportRows(rows:any[],company?:string|string[]):any[];
