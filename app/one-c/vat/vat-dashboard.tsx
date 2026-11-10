'use client';
import Link from 'next/link';
import {rememberReport,recalledReport,forgetReports} from '../../../lib/report-memory.mjs';
import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {ArrowDownToLine,ArrowUpRight,Building2,CheckCircle2,ChevronDown,ChevronRight,Coins,Database,RefreshCw,Settings,X} from 'lucide-react';
import DateRange from '../../date-range';
import MetricHelp from '../../metric-help';
import {VAT_LINES,vatSummary,vatBalanceSummary} from '../../../lib/one-c-vat.mjs';
import {version} from '../../../package.json';
import './vat.css';
type Entry={id:string;date:string;debit:string;credit:string;amount:number;kind:string;companyId:string;company:string;document:string;documentId:string};
type BalanceRow={companyId:string;company:string;opening:number;closing:number};
type Report={balance?:{available:boolean;error?:string;organizations:BalanceRow[]};from:string;to:string;loadedAt:string;entries:Entry[];organizations:{id:string;name:string}[];source:string};
const money=(cents:number,digits=0)=>new Intl.NumberFormat('ru-RU',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(cents/100);
const dateLabel=(s:string)=>s.slice(0,10).split('-').reverse().join('.');
const monthLabel=(s:string)=>s.slice(5)+'.'+s.slice(0,4);
function currentQuarter(){return {from:'2026-07-01',to:'2026-09-30'};}
function quarterLabel(from:string,to:string){const month=Number(from.slice(5,7)),q=Math.floor((month-1)/3)+1,start=`${from.slice(0,4)}-${String((q-1)*3+1).padStart(2,'0')}-01`,end=new Date(Date.UTC(Number(from.slice(0,4)),q*3,0)).toISOString().slice(0,10);return from===start&&to===end?`${['I','II','III','IV'][q-1]} квартал`:'Итого за период'}
export default function VatDashboard(){
 const [period,setPeriod]=useState(currentQuarter),[company,setCompany]=useState(''),[report,setReport]=useState<Report|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[configured,setConfigured]=useState(false),[connected,setConnected]=useState(false),[statusReady,setStatusReady]=useState(false),[openConnection,setOpenConnection]=useState(false),[expanded,setExpanded]=useState({accrued:true,deducted:true}),[detail,setDetail]=useState<{kind:string;month:string;label:string}|null>(null),[detailPage,setDetailPage]=useState(0),[exporting,setExporting]=useState(false);
 const restored=useRef(false),autoLoaded=useRef(false);
 const detailRef=useRef<HTMLDialogElement>(null),formRef=useRef<HTMLFormElement>(null);
 useEffect(()=>{if(statusReady&&(configured||connected)&&!autoLoaded.current){autoLoaded.current=true;if(!restored.current)formRef.current?.requestSubmit()}},[statusReady,configured,connected]);
 useEffect(()=>{let active=true;fetch('/api/one-c/vat',{cache:'no-store'}).then(async r=>{if(!r.ok)return {configured:false,connected:false};return await r.json()}).then(value=>{if(active){setConfigured(!!value.configured);setConnected(!!value.connected);setStatusReady(true);if(value.configured||value.connected){const cached=recalledReport('onec-vat');if(cached){setReport(cached);setPeriod({from:cached.from,to:cached.to});restored.current=true}}else forgetReports('onec-')}}).catch(()=>{if(active){setStatusReady(true);setOpenConnection(true)}});return()=>{active=false}},[]);
 useEffect(()=>{
  const dialog=detailRef.current;
  if(!detail||!dialog)return;
  const previous=document.activeElement as HTMLElement|null;
  const overflow=document.body.style.overflow;
  dialog.showModal();document.body.style.overflow='hidden';
  return()=>{dialog.close();document.body.style.overflow=overflow;previous?.focus({preventScroll:true})};
 },[detail]);
 const stale=!!report&&(report.from!==period.from||report.to!==period.to);
 const summary=useMemo(()=>vatSummary(report?.entries||[],period.from,period.to,company),[report,period,company]);
 const usable=!!report&&!stale&&!busy;
 const totals=summary.buckets.total;
 const balance=useMemo(()=>vatBalanceSummary(report?.balance,company),[report,company]);
 const pendingReason=busy?'Загружаем данные 1С…':stale?'Период изменён — нажмите «Загрузить данные»':error?'Загрузка не завершена — см. сообщение об ошибке':'Загрузите данные из 1С';
 const detailRows=detail?summary.entries.filter((e:Entry)=>(detail.month==='total'||e.date.slice(0,7)===detail.month)&&(detail.kind==='calculated'?e.kind!=='payment':detail.kind==='accrued'||detail.kind==='deducted'?VAT_LINES.some(l=>l.group===detail.kind&&l.id===e.kind):e.kind===detail.kind)):[];
 function showDetail(kind:string,month:string,label:string){setDetail({kind,month,label});setDetailPage(0)}
 function changePeriod(from:string,to:string){setPeriod({from,to});setDetail(null);setError('')}
 async function load(e:FormEvent<HTMLFormElement>){
  e.preventDefault();autoLoaded.current=true;const form=e.currentTarget;const data=new FormData(form);const requested={...period};
  setBusy(true);setError('');setDetail(null);
  try{
   const payload:Record<string,unknown>={...requested};if(!configured&&!connected){payload.user=data.get('user');payload.password=data.get('password');payload.remember=true}
   const r=await fetch('/api/one-c/vat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   delete payload.password;data.delete('password');
   let body;try{body=await r.json()}catch{throw new Error('Сервер не вернул отчёт. Повторите загрузку или сократите период.')}
   if(!r.ok){if(body.code==='ONEC_SESSION'||body.code==='ONEC_AUTH'){setConnected(false);forgetReports('onec-');setOpenConnection(true)}throw new Error(body.error||'Не удалось загрузить данные 1С.')}
   setReport(body);rememberReport('onec-vat',body);setCompany('');if(!configured)setConnected(true);setOpenConnection(false);
  }catch(e){setError(e instanceof Error?e.message:'Ошибка загрузки 1С.')}
  finally{const password=form.elements.namedItem('password') as HTMLInputElement|null;if(password)password.value='';data.delete('password');setBusy(false)}
 }
 function tableRows(){return [
  {id:'accrued',label:'Начислено',className:'accrued',group:true},...expanded.accrued?VAT_LINES.filter(l=>l.group==='accrued').map(l=>({...l,className:'sub',group:false})):[],
  {id:'deducted',label:'Принято к вычету',className:'deducted',group:true},...expanded.deducted?VAT_LINES.filter(l=>l.group==='deducted').map(l=>({...l,className:'sub',group:false})):[],
  {id:'correction',label:'Корректировки НДС',className:'correction',group:false},
  {id:'calculated',label:'Расчётный НДС',className:'calculated',group:false}
 ]}
 function amount(key:string,id:string){const b=summary.buckets[key];return id in b?b[id as keyof typeof b] as number:b.lines[id]}
 async function exportFile(){
  setExporting(true);try{
   const {Workbook}=await import('exceljs');const book=new Workbook(),sheet=book.addWorksheet('НДС по 1С');
   sheet.addRow(['НДС по данным 1С · счёт 68.02']);sheet.addRow(['Период',dateLabel(report!.from)+' — '+dateLabel(report!.to)]);sheet.addRow(['Организация',company?report!.organizations.find(o=>o.id===company)?.name:'Все организации']);
   sheet.addRow(['Статус','Автоматический расчёт по проводкам 1С']);sheet.addRow(['Загружено',report!.loadedAt]);
   sheet.addRow(['Показатель',...summary.months.map(monthLabel),quarterLabel(report!.from,report!.to)]);
   for(const id of ['accrued',...VAT_LINES.filter(l=>l.group==='accrued').map(l=>l.id),'deducted',...VAT_LINES.filter(l=>l.group==='deducted').map(l=>l.id),'correction','calculated','payment']){
    const label=VAT_LINES.find(l=>l.id===id)?.label||({accrued:'Начислено',deducted:'Принято к вычету',correction:'Корректировки',calculated:'Расчётный НДС',payment:'Уплата / зачёты в бюджет'} as Record<string,string>)[id];
    sheet.addRow([label,...[...summary.months,'total'].map(k=>amount(k,id)/100)]);
   }
   sheet.getColumn(1).width=48;for(let i=2;i<=summary.months.length+2;i++){sheet.getColumn(i).width=20;sheet.getColumn(i).numFmt='#,##0.00'}
   const balances=book.addWorksheet('НДС к уплате');
   balances.addRow(['НДС с учётом прошлых периодов',dateLabel(report!.to)]);
   if(balance){balances.addRow(['Организация','Остаток на начало (Кт − Дт)','Изменение за период','К уплате на конец','Дебетовый остаток на конец']);for(const r of balance.rows as BalanceRow[])balances.addRow([r.company,r.opening/100,(r.closing-r.opening)/100,Math.max(0,r.closing)/100,Math.max(0,-r.closing)/100]);balances.addRow(['Итого',balance.opening/100,(balance.closing-balance.opening)/100,balance.payable/100,balance.debit/100]);}else balances.addRow(['Недоступно',report?.balance?.error||'Остатки не загружены']);
   balances.getColumn(1).width=48;for(let i=2;i<=5;i++){balances.getColumn(i).width=26;balances.getColumn(i).numFmt='#,##0.00'}
   const detailSheet=book.addWorksheet('Проводки');detailSheet.addRow(['Дата','Организация','Документ (вид)','Идентификатор документа','Дебет','Кредит','Сумма, руб.','Категория']);
   for(const e of summary.entries as Entry[])detailSheet.addRow([dateLabel(e.date),e.company,e.document,e.documentId,e.debit,e.credit,e.amount/100,VAT_LINES.find(l=>l.id===e.kind)?.label||({correction:'Корректировки НДС',payment:'Уплата / зачёты в бюджет'} as Record<string,string>)[e.kind]||e.kind]);
   detailSheet.columns.forEach(c=>c.width=24);detailSheet.getColumn(7).numFmt='#,##0.00';
   const blob=new Blob([await book.xlsx.writeBuffer() as ArrayBuffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`НДС-1С-${report!.from}-${report!.to}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch{setError('Не удалось подготовить Excel. Повторите выгрузку.')}finally{setExporting(false)}
 }
 return <main className="onec-vat vat-dashboard">
  <header className="vat-header"><Link className="vat-brand" href="/"><span>↗</span><b>Рука на пульсе</b></Link><nav aria-label="Разделы"><Link href="/">Деньги</Link><Link href="/taxes">НДС по оплатам</Link><Link href="/one-c/vat" aria-current="page">НДС по 1С</Link><Link href="/one-c/settlements">Взаиморасчёты по 1С</Link><Link href="/transfers">Переводы</Link><button className="vat-status" aria-label="О демо-данных 1С" onClick={()=>setOpenConnection(v=>!v)}><Settings size={19}/></button></nav></header>
  <div className="vat-content">
   <div className="vat-heading"><div><h1>НДС по данным 1С</h1><p>Предварительный расчёт по счёту 68.02</p></div></div>
   <div className="vat-filters" aria-busy={busy}><fieldset disabled={busy}><DateRange minDate="2000-01-01" from={period.from} to={period.to} onApply={changePeriod}/></fieldset><label className="vat-company"><Building2 size={18}/><select aria-label="Организация" value={company} disabled={!usable} onChange={e=>{setCompany(e.target.value);setDetail(null)}}><option value="">Все организации</option>{report?.organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><select className="vat-quarter" aria-label="Выбрать квартал" disabled={busy} value="" onChange={e=>{if(!e.target.value)return;const [y,q]=e.target.value.split('-').map(Number);changePeriod(new Date(Date.UTC(y,(q-1)*3,1)).toISOString().slice(0,10),new Date(Date.UTC(y,q*3,0)).toISOString().slice(0,10))}}><option value="">Выбрать квартал</option>{[Number(period.from.slice(0,4))-1,Number(period.from.slice(0,4))].flatMap(y=>[1,2,3,4].map(q=><option key={`${y}-${q}`} value={`${y}-${q}`}>{['I','II','III','IV'][q-1]} квартал {y}</option>))}</select><button className="vat-primary" disabled={busy||!statusReady} onClick={()=>{if(configured||connected)formRef.current?.requestSubmit();else setOpenConnection(true)}}><RefreshCw size={16}/>{busy?'Загрузка…':'Загрузить данные'}</button></div>
   <form ref={formRef} onSubmit={load} className="vat-connection" hidden={!openConnection}>
    <div><h2>О демонстрации НДС</h2><p>Вымышленные проводки за июль — ноябрь 2026 года. Подключения к реальной 1С нет. Выберите период и организацию, нажмите на сумму для просмотра примеров проводок.</p></div><button className="vat-primary" disabled={busy||!statusReady}>Обновить демо-отчёт</button>
   </form>
   {error&&<p role="alert" className="vat-error">{error}{report?' Предыдущая выгрузка сохранена; её время указано ниже.':''}</p>}
   {stale&&<p className="vat-notice" role="status">Период изменён. Загрузите данные заново — суммы предыдущего периода скрыты.</p>}
   {!report&&!busy&&<p className="vat-notice">Загрузите проводки за выбранный период. До загрузки суммы не показаны — это не нулевые значения.</p>}
   <section className="vat-cards" aria-label="Основные показатели">
    <article><div>Начислено <MetricHelp text="Сумма проводок Дт 90.03, 91.02, 76.АВ, 76.ВА — Кт 68.02. Сторно учитывается со знаком. Это начисление по бухгалтерскому учёту, не поступления денег."/></div><strong>{usable?money(totals.accrued)+' ₽':'—'}</strong><span>Реализация, авансы и восстановление</span></article>
    <article><div>Принято к вычету <MetricHelp text="Проводки Дт 68.02 — Кт 19.*, 76.АВ, 76.ВА. Учитывается только принятый к вычету НДС, а не весь остаток счёта 19."/></div><strong>{usable?money(totals.deducted)+' ₽':'—'}</strong><span>Покупки и зачёт авансов</span></article>
    <article className="vat-result"><div>Расчётный НДС <MetricHelp text="Начислено − принято к вычету + корректировки со знаком. Платежи и зачёты в бюджет не уменьшают этот показатель. Прочие корреспонденции по 68.02 учитываются как корректировки со знаком; расчёты с бюджетом по счетам 50, 51, 52, 55 и 68.90 — отдельно."/></div><strong>{usable?money(totals.calculated)+' ₽':'—'}</strong><span>{usable?`${money(totals.accrued)} − ${money(totals.deducted)} ${totals.correction<0?'−':'+'} ${money(Math.abs(totals.correction))}`:pendingReason}</span></article>
    <article className="vat-cumulative"><div>НДС к уплате с учётом прошлых периодов <MetricHelp text="Кредитовый остаток счёта 68.02 на конец выбранной даты. Учитывает прошлые периоды, начисления, вычеты, корректировки, оплаты и зачёты в 1С. Перенос на 68.90 уменьшает остаток 68.02; сальдо ЕНС в эту карточку не входит. По группе суммируются положительные остатки организаций, без взаимозачёта между юридическими лицами."/></div><strong><button className="vat-amount" disabled={!usable||!balance} onClick={()=>showDetail('balance','total','НДС с учётом прошлых периодов')} aria-label="Расшифровка НДС к уплате с учётом прошлых периодов">{usable&&balance?money(balance.payable)+' ₽':'—'}</button></strong><span>{usable&&balance?`На ${dateLabel(period.to)} · с учётом оплат и зачётов`:usable?(report?.balance?.error||'Остатки не загружены — обновите отчёт'):pendingReason}</span>{usable&&balance&&balance.debit>0&&<p className="vat-debit-balance">Дебетовый остаток отдельно: {money(balance.debit)} ₽</p>}</article>
   </section>
   <section className="vat-panel"><div className="vat-panel-title"><h2>Начисления, вычеты и корректировки</h2><button className="vat-secondary" disabled={!usable||exporting} onClick={()=>void exportFile()}><ArrowDownToLine size={17}/>{exporting?'Готовим…':'Excel'}</button></div><div className="vat-table-wrap"><table className="vat-table"><thead><tr><th>Показатель</th>{summary.months.map(m=><th key={m}>{monthLabel(m)}</th>)}<th>{quarterLabel(period.from,period.to)}</th></tr></thead><tbody>{tableRows().map(row=><tr key={row.id} className={row.className}><th>{row.group?<button className="vat-row-label" aria-expanded={expanded[row.id as 'accrued'|'deducted']} onClick={()=>setExpanded(prev=>({...prev,[row.id]:!prev[row.id as 'accrued'|'deducted']}))}>{expanded[row.id as 'accrued'|'deducted']?<ChevronDown size={17}/>:<ChevronRight size={17}/>} {row.label}</button>:<span className="vat-row-label">{row.label}{'posting' in row&&<small>{String(row.posting)}</small>}</span>}</th>{[...summary.months,'total'].map(key=><td key={key}>{usable?<button className="vat-amount" onClick={()=>showDetail(row.id,key,row.label)} aria-label={`${row.label}, ${key==='total'?'итого':monthLabel(key)}: ${money(amount(key,row.id),2)} рублей`}>{money(amount(key,row.id),2)}</button>:'—'}</td>)}</tr>)}</tbody></table></div><div className="vat-table-foot"><span>Нажмите на сумму — документы и проводки</span><span>Рубли · таблица с копейками</span></div></section>
   <section className="vat-panel vat-small"><Coins size={25}/><div><h2>Уплата НДС и зачёты в бюджет</h2><button className="vat-payment" disabled={!usable} onClick={()=>showDetail('payment','total','Уплата НДС и зачёты')}>{usable?money(totals.payment)+' ₽':'—'}</button><p>По проводкам 68.02 со счетами 50, 51, 52, 55 и 68.90. Возвраты учитываются со знаком. Не входит в расчётный НДС.</p></div></section>
   {detail&&usable&&<dialog ref={detailRef} aria-labelledby="vat-detail-title" className="vat-panel vat-details" onCancel={()=>setDetail(null)} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)setDetail(null)}}}><div className="vat-panel-title"><div><h2 id="vat-detail-title">{detail.label} · {detail.month==='total'?'весь период':monthLabel(detail.month)}</h2><p>{detail.kind==='balance'?`Остатки 68.02 на ${dateLabel(period.to)} · кредит «+», дебет «−»`:`${detailRows.length} проводок · номер документа пока заменён его идентификатором 1С`}</p></div><button className="vat-secondary" aria-label="Закрыть расшифровку" onClick={()=>setDetail(null)}><X size={18}/></button></div>{detail.kind==='balance'&&balance?<div className="vat-table-wrap"><table className="vat-table"><thead><tr><th>Организация</th><th>Остаток на {dateLabel(period.from)}</th><th>Изменение за период</th><th>К уплате на {dateLabel(period.to)}</th><th>Дебетовый остаток</th></tr></thead><tbody>{balance.rows.map((r:BalanceRow)=><tr key={r.companyId}><th>{r.company}</th><td>{money(r.opening,2)}</td><td>{money(r.closing-r.opening,2)}</td><td>{money(Math.max(0,r.closing),2)}</td><td>{money(Math.max(0,-r.closing),2)}</td></tr>)}<tr className="calculated"><th>Итого</th><td>{money(balance.opening,2)}</td><td>{money(balance.closing-balance.opening,2)}</td><td>{money(balance.payable,2)}</td><td>{money(balance.debit,2)}</td></tr></tbody></table><p className="vat-empty">Начальный остаток + изменение за период = конечный остаток по каждой организации. Дебетовый остаток показывается отдельно и не уменьшает долг других организаций.</p></div>:<div className="vat-table-wrap"><table className="vat-table"><thead><tr><th>Дата</th><th>Организация / документ</th><th>Дебет</th><th>Кредит</th><th>Сумма, ₽</th></tr></thead><tbody>{detailRows.slice(detailPage*50,(detailPage+1)*50).map((e:Entry)=><tr key={e.id}><td>{dateLabel(e.date)}</td><td>{e.company}<small>{e.document}</small><small>{e.documentId}</small></td><td>{e.debit}</td><td>{e.credit}</td><td>{money(e.amount,2)}</td></tr>)}</tbody></table>{!detailRows.length&&<p className="vat-empty">За этот период проводок нет.</p>}</div>}{detail.kind!=='balance'&&detailRows.length>50&&<div className="vat-pagination"><button disabled={!detailPage} onClick={()=>setDetailPage(p=>p-1)}>Назад</button><span>{detailPage+1} / {Math.ceil(detailRows.length/50)}</span><button disabled={(detailPage+1)*50>=detailRows.length} onClick={()=>setDetailPage(p=>p+1)}>Далее</button></div>}</dialog>}
   <footer className="vat-footer"><span>Атлас · Рука на пульсе · v{version}</span><span>{report?<><CheckCircle2 size={14}/> Выгрузка: {new Date(report.loadedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})} МСК</>:'Источник: демонстрационные данные 1С · бухгалтерский учёт'}</span></footer>
  </div>
 </main>
}
