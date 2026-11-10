import {aggregate} from './finance.mjs';
import {isoDate,periodKey} from './taxes.mjs';
import {taxPeriods} from './tax-matrix.mjs';
// Adapt the view only: underlying amounts and grouping rules stay in aggregate.
export function financeView(rows,from,to,group,options={}){
 const periods=taxPeriods(from,to,group);
 const selected=rows.filter(t=>isoDate(t.date)>=from&&isoDate(t.date)<=to).map(t=>({...t,month:periodKey(t.date,group)}));
 return {periods,...aggregate(selected,periods.map(p=>p.key),options)};
}
