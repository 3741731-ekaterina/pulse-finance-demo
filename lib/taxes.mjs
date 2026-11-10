import {isNdflPayment} from './ndfl-payment.mjs';
import {accountOwner,owners,transferReport} from './transfers.mjs';
// Payment-based analysis only. Raw FinTablo values are never overwritten.
export const cents=n=>Math.round((n+Number.EPSILON)*100)/100;
export const isoDate=d=>d.split('.').reverse().join('-');
export function fingerprint(t){return JSON.stringify([2,t.id,t.date,t.value,t.description,t.sourceVat,t.companyId,t.company,t.accountId,t.currency,t.group,t.category,t.split,t.parentValue,t.parentDescription,t.parentSourceVat,t.splitOffset,t.sourceVatAmount]);}
function sourceAnalysis(t){
 const text=(t.description||'').replace(/\u00a0/g,' '), issues=[];
 const rates=[...text.matchAll(/ндс\s*(?:по\s+ставке\s*)?[:(]?\s*(\d{1,2}(?:[.,]\d+)?)\s*%/gi)].map(x=>Number(x[1].replace(',','.')));
 const unique=[...new Set(rates)], without=/без\s+(?:налога\s*\(?\s*)?ндс\)?|ндс\s+не\s+облагается|не\s+облагается\s+ндс/i.test(text);
 const api=t.sourceVat===null||t.sourceVat===undefined||t.sourceVat===''?null:Number(t.sourceVat);
 let rate=unique.length===1?unique[0]:api!==null&&api>0?api:null;
 if(unique.length>1)issues.push('Несколько ставок в назначении');
 if(without&&(unique.some(x=>x>0)||(api!==null&&api>0)))issues.push('«Без НДС» противоречит ставке');
 if(unique.length===1&&api!==null&&api!==unique[0])issues.push('Ставка в назначении отличается от Финтабло');
 if(!t.companyId)issues.push('Не определена группа счёта');
 let kind=without?'without':rate!==null?'vat':'unknown', amount=null;
 // Explicit tax amount must follow the VAT token and optional rate, never invoice numbers.
 const matches=[...text.matchAll(/ндс\s*(?:по\s+ставке\s*)?(?:\(?\s*\d{1,2}(?:[.,]\d+)?\s*%\s*\)?)?\s*(?:[:=—]|в\s+сумме|сумма)?\s*(\d[\d ]*(?:[.,-]\d{2})?)\s*(?:руб|р\.|₽|RUR|RUB|(?=[.;,]|$))/gi)];
 if(matches.length===1)amount=Number(matches[0][1].replaceAll(' ','').replace(/[,-]/,'.'));
 else if(matches.length>1)issues.push('Несколько сумм НДС');
 if(amount!==null&&kind==='unknown')kind='vat';
 const included=/в\s*т\.?\s*ч\.?|в\s+том\s+числе|включая|с\s+ндс/i.test(text);
 if(kind==='without')amount=0;
 else if(rate===0)amount=0;
 else if(amount===null&&rate!==null&&included)amount=cents(t.value*rate/(100+rate));
 const inheritedSplit=t.split&&t.parentValue>0&&t.parentDescription===t.description;
 if(inheritedSplit&&kind==='vat'){
  const parent=analyze({...t,split:false,value:t.parentValue,sourceVat:t.parentSourceVat,sourceVatAmount:undefined});
  if(parent.vat!==null&&parent.kind==='vat'&&(api===null||api===parent.rate)){
   amount=cents(cents(parent.vat*((t.splitOffset||0)+t.value)/t.parentValue)-cents(parent.vat*(t.splitOffset||0)/t.parentValue));
   for(const issue of parent.issues)if(!issues.includes(issue))issues.push(issue);
  }else{amount=null;issues.push('НДС разбивки противоречит исходному платежу');}
 }
 if(amount!==null&&(amount<0||amount>t.value)){issues.push('Сумма НДС вне суммы платежа');amount=null;}
 if(!inheritedSplit&&amount!==null&&rate!==null&&included&&Math.abs(amount-cents(t.value*rate/(100+rate)))>0.02)issues.push('Сумма НДС отличается от расчёта по ставке');
 if(t.split&&!inheritedSplit&&kind==='vat'){issues.push('Разбивка платежа: проверьте НДС каждой части');amount=null;kind='unknown';}
 if(unique.length>1||without&&(unique.some(x=>x>0)||(api!==null&&api>0))){kind='unknown';amount=null;}
 if(kind==='unknown'&&!unique.length&&!without&&amount===null&&issues.every(x=>x==='Не определена группа счёта')){kind='without';amount=0;}
 if(!t.intercompany&&!inheritedSplit&&amount>0&&(api===null||api===0)&&t.sourceVat!==undefined&&!issues.includes('Ставка в назначении отличается от Финтабло'))issues.push('В назначении указан НДС, в Финтабло ставка не заполнена');
 if(t.sourceVatAmount!=null&&amount!==null&&Math.abs(Math.abs(t.sourceVatAmount)-amount)>.02)issues.push('Сумма НДС отличается от Финтабло');
 if(kind==='vat'&&amount===null)issues.push('Не определена сумма НДС в платеже');
 const cat=t.category||'';
 let tax='',penalty=false;
 if(t.group==='outcome'){
  penalty=/пен[яи]|штраф/i.test(cat);

  if(!penalty&&isNdflPayment(t))tax='НДФЛ';
  if(!penalty&&!tax){
   if(/^ндс$|налог.*добавленн/i.test(cat.trim()))tax='НДС в бюджет';
   else if(/взнос[а-яё]*\s+(?:в|во)\s+(?:внебюджетн[а-яё]*\s+)?фонд[а-яё]*/i.test(cat))tax='Взносы в фонды';
   else if(/налоги? с фот/i.test(cat))tax='Налоги с ФОТ';
   else if(/транспортн.*налог/i.test(cat))tax='Транспортный налог';
   else if(/налог|ндфл|страхов.*взнос|енп|усн/i.test(cat)){
    const taxText=cat;
    tax=/ндфл/i.test(taxText)?'НДФЛ':/страхов.*взнос/i.test(taxText)?'Страховые взносы':/налог\s+на\s+прибыль/i.test(taxText)?'Налог на прибыль':/усн/i.test(taxText)?'УСН':/уплата\s+ндс/i.test(taxText)?'НДС в бюджет':/единый налоговый|енп/i.test(taxText)?'ЕНП · без распределения':cat||'Налоговый платёж · уточнить вид';
   }
  }
 }

 return {...t,rate,kind,vat:amount,tax,penalty,issues,status:issues.length?'review':'clear'};
}
// Business reporting policy: compute included VAT; retain source values for accountants.
export function analyze(t){
 const base=sourceAnalysis(t), text=t.description||'';
 const sourceRates=[...text.matchAll(/ндс\s*(?:по\s+ставке\s*)?[:(]?\s*(\d{1,2}(?:[.,]\d+)?)\s*%/gi)].map(x=>Number(x[1].replace(',','.')));
 const sourceRate=[...new Set(sourceRates)].length===1?sourceRates[0]:null;
 const amountMatch=[...text.matchAll(/ндс\s*(?:по\s+ставке\s*)?(?:\(?\s*\d{1,2}(?:[.,]\d+)?\s*%\s*\)?)?\s*(?:[:=—]|в\s+сумме|сумма)?\s*(\d[\d ]*(?:[.,-]\d{2})?)\s*(?:руб|р\.|₽|RUR|RUB|(?=[.;,]|$))/gi)];
 const descriptionVat=amountMatch.length===1?Number(amountMatch[0][1].replaceAll(' ','').replace(/[,-]/,'.')):null;
 const orlov=accountOwner(t.company||t.account||'')==='orlov';
 if(orlov&&t.group==='outcome')return {...base,kind:'without',rate:null,vat:0,descriptionRate:sourceRate,descriptionVat,calculationRule:'Расходы ИП Орлов — без НДС по правилу отчёта',issues:base.issues.filter(x=>x==='Не определена группа счёта'),status:base.companyId?'clear':'review'};
 const ruleRate=t.expectedRate??(orlov&&t.group==='income'&&customerReceipt(t)?5:null);
 let rate=ruleRate??(sourceRate!==null?sourceRate:base.rate),kind=base.kind,vat=base.vat;
 const without=/без\s+(?:налога\s*\(?\s*)?ндс|ндс\s+не\s+облагается|не\s+облагается\s+ндс/i.test(text);
 if(ruleRate!==null){kind='vat';}
 else if(without&&sourceRates.length===0){kind='without';rate=null;vat=0;}
 else if(sourceRates.length<=1&&rate!==null){kind='vat';}
 const issues=[...base.issues];
 if(kind==='vat'&&rate!==null&&(!t.split||t.parentValue>0&&t.parentDescription===t.description)){
  if(t.split){const parentVat=cents(t.parentValue*rate/(100+rate));vat=cents(cents(parentVat*((t.splitOffset||0)+t.value)/t.parentValue)-cents(parentVat*(t.splitOffset||0)/t.parentValue));}
  else vat=cents(t.value*rate/(100+rate));
  if(descriptionVat!==null&&!t.split&&Math.abs(descriptionVat-vat)>.02)issues.push('Сумма НДС в назначении отличается от расчётной');
  if(ruleRate!==null&&sourceRate!==null&&sourceRate!==rate)issues.push('Ставка в назначении отличается от правила ИП Орлов 5%');
  if(ruleRate!==null&&without)issues.push('В назначении «Без НДС», по правилу ИП Орлов применяется 5%');
  if(t.sourceVat!==undefined&&Number(t.sourceVat||0)!==rate)issues.push('Проверьте ставку НДС в Финтабло: расчётная '+rate+'%');
 }
 const filtered=[...new Set(issues)].filter(x=>!(vat!==null&&x==='Не определена сумма НДС в платеже'));
 return {...base,kind,rate,vat,descriptionRate:sourceRate,descriptionVat,calculationRule:ruleRate!==null?'ИП Орлов: сумма оплаты × 5 / 105':kind==='vat'&&rate!==null?'Сумма оплаты × ставка / (100 + ставка)':'По назначению и ставке Финтабло',issues:filtered,status:filtered.length?'review':'clear'};
}
export function reviewed(t,entry){const base=analyze(t);if(!entry)return base;if(entry.fingerprint!==fingerprint(t))return {...base,status:'review',issues:[...base.issues,'Операция изменилась после проверки']};const changed=['kind','rate','vat'].some(k=>entry.value[k]!==base[k]);return {...base,status:changed&&base.issues.length?'review':'verified',issues:base.issues};}
export function periodKey(date,group){const iso=isoDate(date);if(group==='day')return iso;if(group==='week'){const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}return iso.slice(0,7);}

export function taxEligible(t){return !/^(?:мой\s+бизнес|наличные)$/i.test((t.company||'').trim());}
export function intercompanyPayments(transfers){
 const months=[...new Set(transfers.map(t=>t.month))],currencies=[...new Set(transfers.map(t=>t.currency))];
 const valid=currencies.flatMap(currency=>transferReport(transfers,months,{currency}).rows);
 const own=(t,side)=>Boolean(owners[t[side+'Owner']]||/^ип\s/i.test(t[side+'Company']||''));
 return valid.filter(t=>own(t,'from')&&own(t,'to')&&(t.fromCompanyId&&t.toCompanyId?t.fromCompanyId!==t.toCompanyId:t.fromOwner!==t.toOwner)).flatMap(t=>['outcome','income'].map(group=>{const side=group==='outcome'?'from':'to',recipient=t.toCompany||owners[t.toOwner]||t.toAccount,sender=t.fromCompany||owners[t.fromOwner]||t.fromAccount;return {id:`transfer:${t.id}:${group}`,transferId:t.id,transferFromCompanyId:t.fromCompanyId||t.fromOwner,transferToCompanyId:t.toCompanyId||t.toOwner,transferFromCompany:sender,date:t.date,month:t.month,value:group==='outcome'?t.value:(t.received??t.value),group,currency:group==='outcome'?t.currency:t.toCurrency,description:t.description,category:`Оплаты ${sender} → ${recipient}`,companyId:t[side+'CompanyId']||t[side+'Owner'],company:t[side+'Company']||(side==='from'?sender:recipient),accountId:t[side+'Id'],account:t[side+'Account'],sourceVat:t.sourceVat,expectedRate:null,intercompany:true};}));
}

// Customer receipts are identified by articles, never by the mere presence of a counterparty.
export function customerReceipt(t){
 if(t.group!=='income')return false;
 if(t.intercompany)return true; // Contract payments PULSE → Platinum are disclosed separately on the card.
 return /оплата выполненных работ|аванс по контракту|(?:оплата|аванс|поступлени[ея]).*(?:заказчик|клиент)|выручка|оплата.*(?:товар|услуг)/i.test(t.category||'');
}
export function vatBreakdown(rows){
 const groups=new Map();
 for(const t of rows){if(t.kind!=='vat')continue;const label=t.rate===null?'Ставка не указана':`${t.rate}%`;const item=groups.get(label)||{label,rate:t.rate,vat:0,unknown:0};item.vat+=Math.round((t.vat||0)*100);if(t.vat===null)item.unknown++;groups.set(label,item);}
 return [...groups.values()].sort((a,b)=>(a.rate??999)-(b.rate??999)).map(x=>({...x,vat:x.vat/100}));
}

// External payments only; internal transfers are displayed in their own section.
export function vatReportRows(rows,company=''){
 const ids=Array.isArray(company)?company:company?[company]:[];
 return rows.filter(t=>!t.intercompany&&(!ids.length||ids.includes(t.companyId)));
}
