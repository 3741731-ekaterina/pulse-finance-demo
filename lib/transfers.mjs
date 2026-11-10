export const owners={pulse:'Атлас',vector:'Вектор',orlov:'ИП Орлов',sokolov:'ИП Соколов',reserve:'Резерв · кошелёк',morozov:'ИП Морозов А. А. · Алексей Морозов',cash:'Касса группы'};
export function accountOwner(name){
 const n=name.toLowerCase().replaceAll('ё','е');
 if(/атлас|атлас строй/.test(n))return 'pulse';
 if(n.includes('вектор'))return 'vector';
 if(n.includes('орлов'))return 'orlov';
 if(n.includes('соколов'))return 'sokolov';
 if(n.includes('резерв')&&n.includes('евгений'))return 'reserve';
 if(n.includes('алексей морозов')||n.includes('морозов алексей александрович'))return 'morozov';
 if(n.includes('касса'))return 'cash';
 return '';
}
export function normalizeTransfers(transactions,accounts,accountGroups=[]){
 const groups=new Map(accountGroups.map(g=>[String(g.id),g.name]));
 const map=new Map(accounts.map(a=>[String(a.id),a]));const seen=new Set();const transfers=[];
 for(const t of transactions){
  if(t.group!=='transfer'||Number(t.isPlan)===1)continue;
  if(seen.has(String(t.id)))throw new Error('В выгрузке повторяются ID переводов.');seen.add(String(t.id));
  const match=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(t.date||'');const dt=match&&new Date(Date.UTC(+match[3],+match[2]-1,+match[1]));
  const value=Number(t.value),received=t.value2==null?null:Number(t.value2);
  if(!match||dt.getUTCDate()!==+match[1]||dt.getUTCMonth()!==+match[2]-1||!Number.isFinite(value)||value<0||(received!==null&&(!Number.isFinite(received)||received<0)))throw new Error(`Некорректные данные перевода ${t.id}`);
  const from=map.get(String(t.moneybagId)),to=map.get(String(t.moneybag2Id));
  transfers.push({id:String(t.id),date:t.date,month:`${match[3]}-${match[2]}`,value:Math.round(value*100)/100,received:received===null?null:Math.round(received*100)/100,fromId:String(t.moneybagId||''),toId:String(t.moneybag2Id||''),fromAccount:from?.name||`Неизвестный счёт #${t.moneybagId||'—'}`,toAccount:to?.name||`Неизвестный счёт #${t.moneybag2Id||'—'}`,fromOwner:accountOwner(from?.name||''),toOwner:accountOwner(to?.name||''),currency:from?.currency||'UNKNOWN',toCurrency:to?.currency||'UNKNOWN',fromCompanyId:String(from?.groupId||''),toCompanyId:String(to?.groupId||''),fromCompany:groups.get(String(from?.groupId))||'',toCompany:groups.get(String(to?.groupId))||'',sourceVat:t.nds??null,description:t.description||''});
 }
 return transfers;
}
export function transferReport(transfers,months,{currency='RUB',from='',to='',sort='amount-desc',internal=false}={}){
 const ownerId=(t,side)=>t[side+'Owner']||`account:${t[side+'Id']}`;
 const label=(t,side)=>owners[t[side+'Owner']]||t[side+'Account'];
 const matches=()=>false;
 const selected=transfers.filter(t=>months.includes(t.month)&&t.currency===currency&&(!from||ownerId(t,'from')===from)&&(!to||ownerId(t,'to')===to));
 const excluded=selected.filter(matches),valid=selected.filter(t=>!matches(t));
 const within=valid.filter(t=>t.fromOwner&&t.fromOwner===t.toOwner);
 const rows=valid.filter(t=>internal||(ownerId(t,'from')!==ownerId(t,'to')));
 const candidates=new Map();
 for(const t of rows){const key=JSON.stringify([t.date,t.fromId,ownerId(t,'to'),Math.round(t.value*100),t.currency]);const list=candidates.get(key)||[];list.push(t);candidates.set(key,list);}
 const suspectIds=new Set();for(const list of candidates.values())if(list.length>1)for(const t of list)suspectIds.add(t.id);
 const groups=new Map();
 for(const t of rows){const key=JSON.stringify([ownerId(t,'from'),ownerId(t,'to')]);if(!groups.has(key))groups.set(key,{id:key,from:label(t,'from'),to:label(t,'to'),rows:[],values:months.map(()=>0)});const g=groups.get(key);g.rows.push(t);g.values[months.indexOf(t.month)]+=Math.round(t.value*100);}
 const routes=[...groups.values()].map(g=>({...g,values:g.values.map(v=>v/100)}));
 routes.sort((a,b)=>{const name=`${a.from} ${a.to}`.localeCompare(`${b.from} ${b.to}`,'ru');if(sort.startsWith('name'))return sort==='name-desc'?-name:name;const diff=a.values.reduce((s,v)=>s+v,0)-b.values.reduce((s,v)=>s+v,0);return (sort==='amount-asc'?diff:-diff)||name;});
 const totals=months.map(m=>rows.filter(t=>t.month===m).reduce((s,t)=>s+Math.round(t.value*100),0)/100);
 return {routes,rows,excluded,within,suspectIds,totals};
}

// Include matching peers so a new or changed potential duplicate requires another review.
export function transferFingerprint(t,rows){
 const peers=rows.filter(x=>x.date===t.date&&x.fromId===t.fromId&&(x.toOwner||x.toId)===(t.toOwner||t.toId)&&x.value===t.value&&x.currency===t.currency);
 const fields=x=>[x.id,x.date,x.value,x.received,x.fromId,x.toId,x.currency,x.toCurrency,x.description];
 return JSON.stringify([fields(t),peers.map(fields).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]);
}
