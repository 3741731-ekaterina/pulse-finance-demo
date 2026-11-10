import {isoDate,periodKey,cents} from './taxes.mjs';
const display=d=>d.split('-').reverse().join('.');
const add=(iso,days)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
export function taxPeriods(from,to,group){
 if(!from||!to||from>to)return [];
 const out=[];
 for(let cursor=from;cursor<=to;){
  const key=periodKey(display(cursor),group);
  let start=key,end=key;
  if(group==='month'){start=key+'-01';const d=new Date(start+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);end=add(d.toISOString().slice(0,10),-1)}
  if(group==='week')end=add(start,6);
  const first=start<from?from:start,last=end>to?to:end;
  out.push({key,from:first,to:last,label:group==='month'?display(key):group==='day'?display(first):`${display(first)} — ${display(last)}`,partial:first!==start||last!==end});
  cursor=add(last,1);
 }
 return out;
}
export function periodRows(rows,period){return period?rows.filter(t=>{const d=isoDate(t.date);return d>=period.from&&d<=period.to}):rows}
export function metricValue(rows,metric){return cents(rows.reduce((s,t)=>s+Math.round((metric==='value'?t.value:t.vat||0)*100)*(metric==='diff'&&t.group==='outcome'?-1:1),0)/100)}
export function taxMatrixRows(rows,tab){
 const rate=t=>(t.kind==='without'||t.rate===0)?'Без НДС / 0%':t.rate==null?'Ставка не указана':`НДС ${t.rate}%`;
 const splits=(list,metric)=>[...new Set(list.map(rate))].sort((a,b)=>a.startsWith('Без')?1:b.startsWith('Без')?-1:b.localeCompare(a,'ru',{numeric:true})).map(label=>({id:label,label,rows:list.filter(t=>rate(t)===label),metric}));
 if(tab==='taxes')return [...new Set(rows.map(t=>t.tax))].filter(Boolean).map(tax=>({id:tax,label:tax,rows:rows.filter(t=>t.tax===tax),metric:'value',tone:'expense-value'})).concat([{id:'tax-total',label:'Итого уплачено налогов',rows,metric:'value',tone:'expense-value',total:true}]);
 const income=rows.filter(t=>t.group==='income'),expense=rows.filter(t=>t.group==='outcome'),spending=expense.filter(t=>!t.tax);
 return [
  {id:'income',label:'Итого поступлений',rows:income,metric:'value',tone:'green',band:'income',showVat:true,children:splits(income,'value')},
  {id:'spending',label:'Итого списаний без налогов и взносов',rows:spending,metric:'value',tone:'expense-value',band:'expense',showVat:true,children:splits(spending,'value')},
  {id:'diff',label:'Расчётный НДС',rows:[...income,...spending],metric:'diff',tone:'',band:'vat',total:true},
 ];
}
