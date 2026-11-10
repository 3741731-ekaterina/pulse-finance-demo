// Shared accounting arithmetic. Amounts are signed integer kopecks throughout.
export const VAT_LINES=[
 {id:'services',group:'accrued',label:'Работы и услуги',posting:'Дт 90.03 → Кт 68.02'},
 {id:'materials',group:'accrued',label:'Реализация материалов',posting:'Дт 91.02 → Кт 68.02'},
 {id:'customerAdvances',group:'accrued',label:'Авансы покупателей',posting:'Дт 76.АВ → Кт 68.02'},
 {id:'restored',group:'accrued',label:'Восстановленный НДС',posting:'Дт 76.ВА → Кт 68.02'},
 {id:'purchases',group:'deducted',label:'Товары, работы и услуги',posting:'Дт 68.02 → Кт 19.*'},
 {id:'offsetAdvances',group:'deducted',label:'Зачёт авансов покупателей',posting:'Дт 68.02 → Кт 76.АВ'},
 {id:'supplierAdvances',group:'deducted',label:'Авансы поставщикам',posting:'Дт 68.02 → Кт 76.ВА'},
];
export function kopecks(value){
 const s=String(value),m=/^(-?)(\d+)(?:\.(\d{1,2})0*)?$/.exec(s);
 if(!m)throw new Error('Некорректная сумма проводки.');
 const n=Number(m[2])*100+Number((m[3]||'').padEnd(2,'0'));
 if(!Number.isSafeInteger(n))throw new Error('Сумма проводки превышает точность расчёта.');
 return m[1]?-n:n;
}
export function category(dr,cr){
 if(dr!=='68.02'&&cr!=='68.02')return null;
 // Budget settlements / refunds: bank, cash, special bank accounts and ENS.
 const opposite=dr==='68.02'?cr:dr;
 if(/^(50|51|52|55)(\.|$)/.test(opposite)||/^68\.90(\.|$)/.test(opposite))return 'payment';
 if(cr==='68.02')return {'90.03':'services','91.02':'materials','76.АВ':'customerAdvances','76.ВА':'restored'}[dr]||'correction';
 return cr==='19'||cr.startsWith('19.')?'purchases':({'76.АВ':'offsetAdvances','76.ВА':'supplierAdvances'}[cr]||'correction');
}
export function validDates(from,to){
 const valid=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 return valid(from)&&valid(to)&&from<=to&&(Date.parse(to)-Date.parse(from))/86400000<366;
}
export function monthsBetween(from,to){
 if(!validDates(from,to))throw new Error('Выберите период не более года.');
 const result=[];const d=new Date(from.slice(0,7)+'-01T00:00:00Z');
 while(d.toISOString().slice(0,7)<=to.slice(0,7)){result.push(d.toISOString().slice(0,7));d.setUTCMonth(d.getUTCMonth()+1);}
 return result;
}
export function vatSummary(entries,from,to,company=''){
 const months=monthsBetween(from,to),buckets=Object.fromEntries([...months,'total'].map(k=>[k,{accrued:0,deducted:0,correction:0,payment:0,unclassified:0,unclassifiedCount:0,calculated:0,lines:Object.fromEntries(VAT_LINES.map(l=>[l.id,0]))}]));
 const selected=entries.filter(e=>e.date.slice(0,10)>=from&&e.date.slice(0,10)<=to&&(!company||e.companyId===company)).map(e=>({...e,kind:category(e.debit,e.credit)}));
 for(const e of selected){
  const line=VAT_LINES.find(l=>l.id===e.kind);
  const signed=(e.credit==='68.02'?e.amount:0)-(e.debit==='68.02'?e.amount:0);
  for(const key of [e.date.slice(0,7),'total']){const b=buckets[key];if(!b)throw new Error('Некорректный период проводки.');
   if(line){b.lines[e.kind]+=e.amount;b[line.group]+=e.amount;}
   else if(e.kind==='correction')b.correction+=signed;
   else if(e.kind==='payment')b.payment-=signed;
   else {b.unclassified+=signed;b.unclassifiedCount++;}
   b.calculated=b.accrued-b.deducted+b.correction;
   for(const n of [b.accrued,b.deducted,b.correction,b.payment,b.calculated])if(!Number.isSafeInteger(n))throw new Error('Итог превышает точность расчёта.');
  }
 }
 return {months,buckets,entries:selected,complete:buckets.total.unclassifiedCount===0};
}

// Payable is summed per legal entity: a debit balance of one company cannot pay another's debt.
export function vatBalanceSummary(balance,company=''){
 if(!balance?.available)return null;
 const rows=balance.organizations.filter(o=>!company||o.companyId===company);
 const totals={payable:0,debit:0,opening:0,closing:0};
 for(const r of rows){
  if(!Number.isSafeInteger(r.opening)||!Number.isSafeInteger(r.closing))throw new Error('Некорректный остаток НДС.');
  totals.payable+=Math.max(0,r.closing);totals.debit+=Math.max(0,-r.closing);totals.opening+=r.opening;totals.closing+=r.closing;
 }
 if(Object.values(totals).some(v=>!Number.isSafeInteger(v)))throw new Error('Итог превышает точность расчёта.');
 return {...totals,rows};
}
