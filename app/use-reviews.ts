'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
type Data={saved:{tax:Record<string,any>;transfer:Record<string,any>};versions:{tax:Record<string,string>;transfer:Record<string,string>};history:any[]};
const empty=():Data=>({saved:{tax:{},transfer:{}},versions:{tax:{},transfer:{}},history:[]});
export function useReviews(kind:'tax'|'transfer',scope:string,demo:boolean){
 const [data,setData]=useState<Data>(empty),[ready,setReady]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const ref=useRef(data),inFlight=useRef(false),epoch=useRef(0);const storage=(kind==='tax'?'pulse-tax-reviews-v1:':'pulse-transfer-reviews-v1:')+scope;
 const accept=useCallback((next:Data)=>{ref.current=next;setData(next)},[]);
 const load=useCallback(async()=>{const r=await fetch('/api/reviews',{cache:'no-store'});const j:any=await r.json();if(!r.ok)throw new Error(j.error);return j as Data},[]);
 useEffect(()=>{let live=true,working=false;
  async function refresh(initial=false){if(working||inFlight.current)return;working=true;const generation=epoch.current;try{
   if(demo){const local=JSON.parse(localStorage.getItem(storage)||'{}'),next=empty();next.saved[kind]=kind==='tax'?local.saved||{}:local;next.history=kind==='tax'?local.history||[]:[];if(live){accept(next);setReady(true)}return;}
   let next=await load();
   // Import only absent records. Server tombstones prevent old browsers resurrecting an undone check.
   if(initial){const local=JSON.parse(localStorage.getItem(storage)||'{}'),entries=kind==='tax'?local.saved||{}:local;
    for(const [id,entry] of Object.entries(entries)){if(!live)break;if(next.versions[kind][id])continue;const r=await fetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,id,entry,action:'import',expected:null,requestId:crypto.randomUUID()})});const j:any=await r.json();if(!r.ok)throw new Error(j.error);next=j;}
   }
   if(live&&generation===epoch.current){accept(next);setReady(true);setError('')}
  }catch(e){if(live){setReady(false);setError(e instanceof Error?e.message:'Не удалось загрузить серверные проверки.')}}finally{working=false}}
  void refresh(true);const focus=()=>{if(!document.hidden)void refresh()};window.addEventListener('focus',focus);const timer=setInterval(focus,30000);
  return()=>{live=false;clearInterval(timer);window.removeEventListener('focus',focus)};
 },[kind,storage,demo,load,accept]);
 const save=async(id:string,entry:any|null)=>{if(inFlight.current||!ready)return false;inFlight.current=true;epoch.current++;setSaving(true);setError('');try{
  if(demo){const next=structuredClone(ref.current),before=next.saved[kind][id]||null;if(entry)next.saved[kind][id]=entry;else delete next.saved[kind][id];next.history.push({kind,id,before,after:entry||{at:new Date().toISOString(),by:'Демонстрация',reason:'Отмена проверки',value:null}});localStorage.setItem(storage,JSON.stringify(kind==='tax'?{saved:next.saved.tax,history:next.history}:next.saved.transfer));accept(next);return true;}
  const r=await fetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,id,entry,action:entry?'save':'undo',expected:ref.current.versions[kind][id]||null,requestId:crypto.randomUUID()})});const j:any=await r.json();if(!r.ok){if(r.status===409)accept(await load());throw new Error(j.error)}accept(j);return true;
 }catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить отметку.');return false}finally{inFlight.current=false;setSaving(false)}};
 return {saved:data.saved[kind],history:data.history.filter(h=>!h.kind||h.kind===kind),ready:ready&&!saving,saving,error,save};
}
