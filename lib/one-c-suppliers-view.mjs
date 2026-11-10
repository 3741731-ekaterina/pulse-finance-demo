const fail=m=>{throw new Error(m)};
const key=r=>[r.companyId,r.supplierId,r.contractId||''].join('|');
const metrics=['openingDebt','openingAdvance','payments','purchases','other','closingDebt','closingAdvance','difference'];
export function supplierSummary(rows,company=''){
 const selected=rows.filter(r=>!company||r.companyId===company),groups=new Map(),totals=Object.fromEntries(metrics.map(k=>[k,0]));
 for(const r of selected){const id=r.companyId+'|'+r.supplierId;if(!groups.has(id))groups.set(id,{id,company:r.company,supplier:r.supplier,contracts:[],...Object.fromEntries(metrics.map(k=>[k,0]))});const g=groups.get(id);g.contracts.push(r);for(const m of metrics){g[m]+=r[m];totals[m]+=r[m];}}
 if(Object.values(totals).some(v=>!Number.isSafeInteger(v)))fail('Сумма превышает точность расчёта.');
 return {rows:selected,suppliers:[...groups.values()].sort((a,b)=>b.closingDebt-a.closingDebt),totals};
}
export function buildSupplierReport(opening,closing,movements){
 const groups=new Map();const ensure=r=>{const id=key(r);if(!groups.has(id))groups.set(id,{id,...r,...Object.fromEntries(metrics.map(k=>[k,0])),operations:[]});return groups.get(id)};
 for(const [list,prefix] of [[opening,'opening'],[closing,'closing']])for(const r of list){const g=ensure(r);g[prefix+'Debt']+=r.credit;g[prefix+'Advance']+=r.debit;}
 for(const r of movements){const g=ensure(r);if(r.kind==='payment')g.payments-=r.delta;else if(r.kind==='purchase')g.purchases+=r.delta;else g.other+=r.delta;g.operations.push(r);}
 for(const g of groups.values()){g.difference=g.closingDebt-g.closingAdvance-(g.openingDebt-g.openingAdvance+g.purchases-g.payments+g.other);if(metrics.some(m=>!Number.isSafeInteger(g[m])))fail('Некорректный итог расчётов.');}
 return [...groups.values()];
}
