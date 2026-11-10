import {isNdflPayment} from './ndfl-payment.mjs';
export function monthRange(end) {
  if (!/^\d{4}-\d{2}$/.test(end) || end < '2026-07' || +end.slice(5) < 1 || +end.slice(5)>12 || end > '2040-12') throw new Error('Некорректный период');
  const months=[]; let y=2026,m=7;
  while (`${y}-${String(m).padStart(2,'0')}`<=end) {months.push(`${y}-${String(m).padStart(2,'0')}`); if(++m===13){m=1;y++;}}
  return months;
}
const index = a => new Map(a.map(x=>[String(x.id),x]));
export function monthlyChange(value,previous){
  if(previous==null)return null;
  const difference=(Math.round(value*100)-Math.round(previous*100))/100;
  return {difference,percent:previous===0?null:difference/previous*100,direction:difference>0?'up':difference<0?'down':'same'};
}
export function normalize(data) {
  const deals=index(data.deals), partners=index(data.partners), categories=index(data.categories), accounts=index(data.accounts), cities=index(data.cities);
  for(const d of data.deals) for(const stage of d.stages||[]) deals.set(String(stage.id),d);
  const transactions=index(data.transactions);
  if(transactions.size!==data.transactions.length) throw new Error('В выгрузке повторяются ID операций. Расчёт остановлен.');
  // FinTablo embeds split parts in `subs`; those parts omit payment-level
  // date, group and account. Keep their own category, deal and counterparty.
  for(const parent of transactions.values()){
    if(parent.subs!=null&&!Array.isArray(parent.subs))throw new Error(`Некорректная разбивка операции ${parent.id}`);
    for(const sub of parent.subs||[]){
      if(!sub.id||String(sub.id)===String(parent.id)||(sub.parentId&&String(sub.parentId)!==String(parent.id)))throw new Error(`Некорректная разбивка операции ${parent.id}`);
      const existing=transactions.get(String(sub.id));
      if(existing&&(Math.round(Number(existing.value)*100)!==Math.round(Number(sub.value)*100)||String(existing.parentId)!==String(parent.id)))throw new Error(`Противоречивые части операции ${parent.id}`);
      transactions.set(String(sub.id),{...existing,...sub,parentId:parent.id,date:sub.date||existing?.date||parent.date,group:sub.group||existing?.group||parent.group,moneybagId:sub.moneybagId||existing?.moneybagId||parent.moneybagId,isPlan:parent.isPlan??sub.isPlan??0,description:sub.description||parent.description||''});
    }
  }
  const parents=new Map();
  for(const t of transactions.values()) if(t.parentId && transactions.has(String(t.parentId))) parents.set(String(t.parentId),(parents.get(String(t.parentId))||0)+Math.round(Number(t.value)*100));
  for(const [id,sum] of parents) if(Math.abs(Math.round(Number(transactions.get(id).value)*100)-sum)>1) throw new Error(`Не сошлась разбивка операции ${id}. Проверьте её в Финтабло.`);
  const accountGroups=index(data.accountGroups||[]);
  const rows=[]; let skipped=0;
  for(const t of transactions.values()){
    if(t.group==='transfer'||Number(t.isPlan)===1||parents.has(String(t.id))){skipped++;continue;}
    if(!['income','outcome'].includes(t.group)) throw new Error(`Неизвестный тип операции ${t.id}`);
    const parent=transactions.get(String(t.parentId));
    const date=t.date||parent?.date;
    const match=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(date||'');
    const value=Number(t.value);
    if(!match||!Number.isFinite(value)||value<0) throw new Error(`Проверьте дату и сумму операции ${t.id}`);
    const dt=new Date(Date.UTC(+match[3],+match[2]-1,+match[1]));
    if(dt.getUTCDate()!==+match[1]||dt.getUTCMonth()!==+match[2]-1)throw new Error(`Некорректная дата операции ${t.id}`);
    const deal=deals.get(String(t.dealId));
    const cityId=deal?.directionId||t.directionId||'';
    const partnerId=t.partnerId||deal?.partnerId||'';
    const account=accounts.get(String(t.moneybagId||parent?.moneybagId));
    rows.push({accountId:String(account?.id||''),account:account?.name||'Счёт не определён',companyId:accountGroups.has(String(account?.groupId))?String(account.groupId):'',company:accountGroups.get(String(account?.groupId))?.name||'Компания не определена',parentValue:parent?Number(parent.value):null,parentSourceVat:parent?.nds??null,parentDescription:parent?.description||'',splitOffset:parent?[...transactions.values()].filter(x=>String(x.parentId)===String(parent.id)&&String(x.id).localeCompare(String(t.id))<0).reduce((a,x)=>a+Math.round(Number(x.value)*100),0)/100:0,sourceVat:t.nds??null,split:!!t.parentId,id:String(t.id),date,month:`${match[3]}-${match[2]}`,value:Math.round(value*100)/100,group:t.group,dealId:deal?String(deal.id):t.dealId?`unknown-${t.dealId}`:'',deal:deal?.name||(t.dealId?`Неизвестная сделка #${t.dealId}`:'Без объекта'),cityId:String(cityId),city:cities.get(String(cityId))?.name||(cityId?`Город #${cityId}`:'Город не указан'),partnerId:String(partnerId),partner:partners.get(String(partnerId))?.name||(partnerId?`Контрагент #${partnerId}`:'Заказчик не указан'),categoryId:String(t.categoryId||''),category:categories.get(String(t.categoryId))?.name||(t.categoryId?`Статья #${t.categoryId} · не загружена`:'Статья не передана API'),currency:account?.currency||'UNKNOWN',description:t.description||''});
  }
  return {rows,skipped};
}
// Explicit dashboard presentation rules; source deal links are retained in operations.
function unallocatedObjectArticle(t) {
 const name=String(t.category||'').toLowerCase().replaceAll('ё','е').replace(/[.\s_-]+/g,' ');
 return /иностран|ин\s*граждан|питани.*(?:работник|сотрудник|рабоч)|проектирован|экспертиз|обслуживан.*(?:техник|транспорт)|(?:вывоз|вывод).*мусор.*стро|инструмент|инвентар/.test(name);
}
function financialArticle(t) {
 const name=String(t.category||'').toLowerCase().replaceAll('ё','е');
 return !/процент/.test(name)&&/займ|заем|кредит|(?:вывод|выплат|распределен).*прибыл|дивиденд/.test(name);
}
export function expensePurpose(t) {
 const name=String(t.category||'').toLowerCase().replaceAll('ё','е');
 // Explicit NDFL remittances override incorrect source articles.
 if(isNdflPayment(t))return 'taxes';
 // Other taxes use the source article, not VAT mentioned in purchases.
 if (!/пен[яи]|штраф/.test(name) && /(?:^|[^а-я])ндс(?:$|[^а-я])|налог.*добавленн|налог\s+на\s+прибыль|налог.*фот|взнос[а-я]*\s+(?:в|во)\s+(?:внебюджетн[а-я]*\s+)?фонд|ндфл/.test(name)) return 'taxes';
 if (/процент/.test(name)) return 'admin';
 if (financialArticle(t)) return 'financial';
 if (unallocatedObjectArticle(t)) return 'objects';
 if (/административ|офис|канцеляр|бухгалтер|управленческ/.test(name)) return 'admin';
 if (t.dealId || /материал|субподряд|строительн|спецтехник/.test(name)) return 'objects';
 return 'admin';
}
export function aggregate(rows,months,{city='',company='',currency='RUB',general=[],incomeView='customer',sort='amount-desc'}={}) {
  const selected=rows.filter(t=>months.includes(t.month)&&(!city||t.cityId===city)&&(Array.isArray(company)?!company.length||company.includes(t.companyId):!company||t.companyId===company)&&t.currency===currency);
  const make=(id,label,kind,subset,children=[])=>({id,label,kind,values:months.map(m=>Math.round(subset.filter(t=>t.month===m).reduce((a,t)=>a+Math.round(t.value*100),0))/100),ids:subset.map(t=>t.id),children});
  const group=(subset,key,label,child)=>Array.from(new Set(subset.map(t=>t[key]))).map(id=>{const part=subset.filter(t=>t[key]===id);return make(String(id)||'none',part[0][label],'detail',part,child?child(part):[])}).sort((a,b)=>{const name=a.label.localeCompare(b.label,'ru',{numeric:true});if(sort==='name-asc')return name;if(sort==='name-desc')return -name;const diff=a.values.reduce((x,y)=>x+y,0)-b.values.reduce((x,y)=>x+y,0);return (sort==='amount-asc'?diff:-diff)||name});
  const incomes=selected.filter(t=>t.group==='income'),outcomes=selected.filter(t=>t.group==='outcome');
  const objects=outcomes.filter(t=>expensePurpose(t)==='objects'),assigned=objects.filter(t=>!!t.dealId&&!unallocatedObjectArticle(t)),unallocated=objects.filter(t=>!t.dealId||unallocatedObjectArticle(t)),admin=outcomes.filter(t=>expensePurpose(t)==='admin'),taxes=outcomes.filter(t=>expensePurpose(t)==='taxes'),financial=outcomes.filter(t=>expensePurpose(t)==='financial'),outside=outcomes.filter(t=>!t.dealId);
  const articles=part=>group(part,'categoryId','category');
  const financialIncome=incomes.filter(financialArticle),ordinaryIncome=incomes.filter(t=>!financialArticle(t));
  const incomeChildren=incomeView==='object'
    ?group(ordinaryIncome,'dealId','deal',part=>group(part,'partnerId','partner',articles))
    :group(ordinaryIncome,'partnerId','partner',part=>group(part,'dealId','deal',articles));
  if(financialIncome.length)incomeChildren.push(make('financial','Финансовые платежи','section',financialIncome,articles(financialIncome)));
  const income=make('income','Поступления','income',incomes,incomeChildren);
  const expense=make('expense','Расходы','expense',outcomes,[make('objects','Расходы на объекты','section',objects,[make('assigned','По сделкам','section',assigned,group(assigned,'dealId','deal',articles)),make('unallocated','Без распределения по сделкам','section',unallocated,articles(unallocated))]),make('admin','Административные расходы','section',admin,articles(admin)),make('taxes','Налоговые платежи','section',taxes,articles(taxes)),make('financial','Финансовые платежи','section',financial,articles(financial))]);
  const net={id:'net',label:'Чистый денежный поток',kind:'net',values:months.map((_,i)=>Math.round((income.values[i]-expense.values[i])*100)/100),ids:selected.map(t=>t.id),children:[]};
  return {tree:[income,expense,net],selected,income:income.values,expense:expense.values,net:net.values,unassigned:0,outside:outside.reduce((a,t)=>a+t.value,0)};
}
export function demoData(){
 const rows=[]; let id=0;
 const objects=[['1','ЖК «Северный»','1','Тюмень','1','Заказчик А'],['2','Бизнес-центр «Речной»','1','Тюмень','2','Заказчик Б'],['3','ЖК «Парк»','2','Екатеринбург','1','Заказчик А']];
 for(let m=7;m<=9;m++) for(const [d,n,c,city,p,partner] of objects){
  for(const [group,categoryId,category,value] of [['income','1','Оплата по договору',(3.2+(m-7)*.5+Number(d)*.3)*1e6],['outcome','2','Оплата труда',(1.2+Number(d)*.2)*1e6],['outcome','3','Материалы',(0.4+(m-7)*.15)*1e6]]) rows.push({id:String(++id),date:`15.0${m}.2026`,month:`2026-0${m}`,value,group,dealId:d,deal:n,cityId:c,city,partnerId:p,partner,categoryId,category,currency:'RUB',description:'Вымышленная операция для демонстрации'});
 }
 for(let m=7;m<=9;m++) for(const [cat,name,value] of [['4','Административная зарплата',650000],['5','Аренда офиса',180000],['6','Транспорт',95000],['3','Материалы',250000]])rows.push({id:String(++id),date:`20.0${m}.2026`,month:`2026-0${m}`,value,group:'outcome',dealId:'',deal:'Без объекта',cityId:'',city:'Город не указан',partnerId:'',partner:'Контрагент не указан',categoryId:cat,category:name,currency:'RUB',description:'Вымышленная операция для демонстрации'});
 return {rows,skipped:0,loadedAt:new Date().toISOString(),through:'2026-09',demo:true};
}
