import ExcelJS from 'exceljs';
import {monthlyChange} from './finance.mjs';
const colors={income:'FF26704E',expense:'FFB2403C',good:'FFE7F4EC',bad:'FFFCE9E7'};
const total=values=>values.reduce((s,v)=>s+Math.round(v*100),0)/100;
export function comparisonFill(flow,value,previous){
 const change=monthlyChange(value,previous);
 if(!change||change.direction==='same'||!['income','expense'].includes(flow))return null;
 return colors[(flow==='income')===(change.direction==='up')?'good':'bad'];
}
function sheetBase(name,headers,metadata){
 const book=new ExcelJS.Workbook();book.creator='Атлас · Финансы';
 const sheet=book.addWorksheet(name,{views:[{state:'frozen',xSplit:1,ySplit:metadata.length+1}]});
 metadata.forEach(values=>sheet.addRow(values));
 const head=sheet.addRow(headers);head.height=30;
 head.eachCell(cell=>{cell.font={name:'Arial',size:12,bold:true,color:{argb:'FF202020'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF9CE00'}};});
 sheet.columns=headers.map((_,i)=>({width:i===0?60:25}));
 return {book,sheet};
}
export async function reportWorkbook({tree,months,monthLabels,historyMonths,historyRows,metadata}){
 const {book,sheet}=sheetBase('Движение денег',['Показатель',...monthLabels,'Итого'],metadata);
 function add(rows,parent='',depth=0){for(const item of rows){
  const path=parent?`${parent}/${item.id}`:item.id,flow=path.split('/')[0];
  const row=sheet.addRow([item.label,...item.values,total(item.values)]);row.height=26;row.outlineLevel=Math.min(depth,7);
  row.getCell(1).alignment={indent:depth,vertical:'middle'};
  row.eachCell((cell,col)=>{
   cell.font={name:'Arial',size:11,bold:depth===0,color:{argb:col>1?(colors[flow]||'FF202020'):'FF202020'}};
   if(col>1){cell.numFmt='#,##0.00';cell.alignment={horizontal:'right',vertical:'middle'};}
   if(depth===0)cell.border={top:{style:'thin',color:{argb:'FFD5D2C8'}}};
   if(col>1&&col<=months.length+1&&item.kind!=='operation'){
    const index=historyMonths.indexOf(months[col-2]);
    const fill=comparisonFill(flow,item.values[col-2],index>0?historyRows.get(path)?.values[index-1]:undefined);
    if(fill)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
   }
  });add(item.children,path,depth+1);
 }}
 add(tree);return book.xlsx.writeBuffer();
}
export async function paymentsWorkbook({rows,metadata}){
 const {book,sheet}=sheetBase('Платежи',['Дата','Тип','Заказчик / контрагент','Город','Объект','Статья','Сумма','Валюта','Назначение'],metadata);
 sheet.columns=[16,20,42,22,48,38,25,12,65].map(width=>({width}));
 for(const t of rows){const row=sheet.addRow([t.date,t.group==='income'?'Поступление':'Расход',t.partner,t.city,t.deal,t.category,t.value,t.currency,t.description]);row.eachCell(c=>{c.font={name:'Arial',size:11};});const amount=row.getCell(7);amount.numFmt='#,##0.00';amount.font={name:'Arial',size:11,color:{argb:colors[t.group==='income'?'income':'expense']}};}
 return book.xlsx.writeBuffer();
}

export async function transfersWorkbook({report,monthLabels,metadata}){
 const {book,sheet}=sheetBase('Переводы',['Отправитель','Получатель',...monthLabels,'Итого'],metadata);
 sheet.getColumn(2).width=48;
 sheet.addRow(['Всего переводов','',...report.totals,total(report.totals)]);
 for(const r of report.routes)sheet.addRow([r.from,r.to,...r.values,total(r.values)]);
 sheet.eachRow((row,i)=>{if(i>metadata.length+1)row.eachCell((c,n)=>{c.font={name:'Arial',size:11,bold:i===metadata.length+2};if(n>2)c.numFmt='#,##0.00';});});
 const details=book.addWorksheet('Операции',{views:[{state:'frozen',ySplit:1}]});
 details.addRow(['ID','Дата','Со счёта','На счёт','Списано','Валюта списания','Получено','Валюта получения','Статус','Назначение']);
 details.columns=[18,16,48,48,24,18,24,18,44,70].map(width=>({width}));
 for(const t of [...report.rows,...report.excluded]){const excluded=report.excluded.some(x=>x.id===t.id),suspect=report.suspectIds.has(t.id);const row=details.addRow([t.id,t.date,t.fromAccount,t.toAccount,t.value,t.currency,t.received,t.toCurrency,excluded?'Исключён: подтверждённый дубль':suspect?'Включён: возможный дубль, проверить':report.verifiedIds?.has(t.id)?'Проверено: реальный перевод, не дубль':'Включён',t.description]);row.getCell(5).numFmt='#,##0.00';row.getCell(7).numFmt='#,##0.00';if(excluded||suspect)row.eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:excluded?'FFEDEBE6':'FFFFF2CF'}};});}
 details.getRow(1).eachCell(c=>{c.font={bold:true};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF9CE00'}}});
 return book.xlsx.writeBuffer();
}
