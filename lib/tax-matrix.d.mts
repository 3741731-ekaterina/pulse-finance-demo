export type TaxPeriod={key:string;from:string;to:string;label:string;partial:boolean};
export function taxPeriods(from:string,to:string,group:string):TaxPeriod[];
export function periodRows(rows:any[],period?:TaxPeriod):any[];
export function metricValue(rows:any[],metric:string):number;
export function taxMatrixRows(rows:any[],tab:string):any[];
