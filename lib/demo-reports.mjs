import {category,validDates} from './one-c-vat.mjs';
import {buildSupplierReport} from './one-c-suppliers-view.mjs';
export const companies=[{id:'atlas',name:'Атлас Строй'},{id:'vector',name:'Вектор Проект'},{id:'orlov',name:'ИП Орлов'}];
const loadedAt='2026-11-10T09:00:00.000Z';
const months=['2026-07','2026-08','2026-09','2026-10','2026-11'];
export function financeDemo(){
 const rows=[],transfers=[];let serial=0;
 const objects=['ЖК «Горизонт»','Бизнес-парк «Орбита»','Квартал «Липовый»'];
 for(const [mi,month] of months.entries())for(const [ci,c] of companies.entries()){
  const add=(group,category,value,rate,dealId='',day=15)=>{const dayString=String(month==='2026-11'?Math.min(day,9):day).padStart(2,'0');rows.push({id:'demo-'+(++serial),date:dayString+'.'+month.slice(5)+'.2026',month,value:Math.round(value),group,dealId,deal:dealId?objects[Number(dealId)-1]:'Без объекта',cityId:ci%2?'kazan':'perm',city:ci%2?'Казань':'Пермь',partnerId:'partner-'+ci,partner:group==='income'?['Девелопмент «Аврора»','Группа «Спектр»','Городские пространства'][ci]:['Стройресурс','Технопарк','Комфорт Сервис'][ci],companyId:c.id,company:c.name,accountId:c.id+'-bank',account:c.name+' · расчётный счёт',categoryId:category,category,currency:'RUB',sourceVat:rate,description:rate?`Демонстрационная оплата. В т.ч. НДС ${rate}%`:'Демонстрационная оплата. Без НДС'});};
  const f=(1+mi*.11)*(ci===0?1:ci===1?.42:.18);
  for(let j=1;j<=3;j++){add('income','Оплата выполненных работ по КС2 / КС3',(3100000+j*230000)*f,22,String(j),7+j);add('outcome','Работы субподрядчиков',(900000+j*95000)*f,j===2?5:22,String(j),14+j)}
  for(const [label,value,rate] of [['Материалы',1400000,22],['Аренда техники',460000,20],['Инструмент и инвентарь',160000,7],['Питание работников',120000,5],['Доставка материалов',230000,0],['Административная зарплата',480000,0],['Аренда офиса',110000,22],['Проценты по кредиту',42000,0],['НДС',320000,0],['НДФЛ',98000,0],['Взносы в фонды',147000,0],['Налог на прибыль',66000,0],['Вывод прибыли',180000,0]])add('outcome',label,value*f,rate,'',22);
  if(ci<2){const recipient=companies[ci+1];transfers.push({id:'transfer-'+month+'-'+ci,date:`09.${month.slice(5)}.2026`,month,value:Math.round(650000*f),received:Math.round(650000*f),fromId:c.id+'-bank',toId:recipient.id+'-bank',fromAccount:c.name+' · расчётный счёт',toAccount:recipient.name+' · расчётный счёт',fromOwner:ci===0?'pulse':'vector',toOwner:ci===0?'vector':'orlov',fromCompanyId:c.id,toCompanyId:recipient.id,fromCompany:c.name,toCompany:recipient.name,currency:'RUB',toCurrency:'RUB',sourceVat:0,description:'Вымышленный внутригрупповой перевод. Без НДС'});}
 }
 return {rows,transfers,loadedAt,through:'2026-11',demo:true,reviewScope:'portfolio',skipped:0};
}
function checked(from,to){if(!validDates(from,to))throw new Error('Выберите период до одного года.');}
const selected=(date,from,to)=>date>=from&&date<=to;
export function vatDemo(from,to){checked(from,to);const all=[];for(const [mi,m] of months.entries())for(const [ci,c] of companies.entries())for(const [i,[dr,cr,rubles]] of [['90.03','68.02',1700000],['91.02','68.02',32000],['76.АВ','68.02',340000],['76.ВА','68.02',19000],['68.02','19.03',920000],['68.02','76.АВ',220000],['68.02','76.ВА',57000],['68.02','68.90',410000]].entries()){
 const date=m+'-'+String(m==='2026-11'?8:10+i).padStart(2,'0');all.push({id:`vat-${mi}-${ci}-${i}`,date,debit:dr,credit:cr,amount:Math.round(rubles*100*(1+mi*.1)*(ci===0?1:ci===1?.4:.15)),kind:category(dr,cr),companyId:c.id,company:c.name,document:'Демо-документ №'+(i+1),documentId:`demo-${mi}-${ci}-${i}`});}
 const balances=companies.map((c,i)=>{const balanceAt=date=>(1300000+i*150000)*100+all.filter(e=>e.companyId===c.id&&e.date<date).reduce((sum,e)=>sum+(e.credit==='68.02'?e.amount:-e.amount),0);return {companyId:c.id,company:c.name,opening:balanceAt(from),closing:balanceAt(new Date(Date.parse(to)+86400000).toISOString().slice(0,10))}});
 return {from,to,loadedAt,entries:all.filter(e=>selected(e.date,from,to)),organizations:companies,source:'Демонстрация 1С',balance:{available:true,organizations:balances}};
}
export function suppliersDemo(from,to){checked(from,to);const opening=[],closing=[],movements=[];
 for(const [ci,c] of companies.entries())for(let si=0;si<6;si++)for(let contract=0;contract<2;contract++){
  const identity={companyId:c.id,company:c.name,supplierId:'supplier-'+si,supplier:['Стройресурс','Технопарк','Лесная мануфактура','Комфорт Сервис','Регион Логистик','Промкомплект'][si],contractId:'contract-'+contract,contract:contract?'Договор поставки № 02 · аванс':'Договор работ № 01'};
  const all=[];for(const [mi,m] of months.entries())for(const kind of ['payment','purchase']){if(contract&&kind==='purchase')continue;const amount=Math.round((kind==='payment'?180000:210000)*(1+si*.16)*(1+mi*.08)/(ci+1))*100;all.push({...identity,id:`op-${ci}-${si}-${contract}-${mi}-${kind}`,date:m+'-08',debit:kind==='payment'?'60.01':'10.01',credit:kind==='payment'?'51':'60.01',amount,delta:kind==='payment'?-amount:amount,kind,operationType:kind==='payment'?'Оплата поставщику':'Поступление товаров и услуг'})}
  const start=(contract?-260000:950000+si*85000)*100;const balance=date=>start+all.filter(o=>o.date<date).reduce((s,o)=>s+o.delta,0);const row=value=>({...identity,credit:Math.max(0,value),debit:Math.max(0,-value)});
  opening.push(row(balance(from)));closing.push(row(balance(new Date(Date.parse(to)+86400000).toISOString().slice(0,10))));movements.push(...all.filter(o=>selected(o.date,from,to)));
 }
 return {from,to,loadedAt,contracts:buildSupplierReport(opening,closing,movements),organizations:companies,source:'Демонстрация · счёт 60',contractAccounting:true};
}
