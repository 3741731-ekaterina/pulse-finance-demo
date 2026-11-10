'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
export default function MetricHelp({text}:{text:string}){
 const [open,setOpen]=useState(false),id=useId(),dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(open)dialog.current?.showModal()},[open]);
 return <><span className="metric-help" role="button" tabIndex={0} aria-label="Как считается показатель" aria-haspopup="dialog" title={text} onClick={e=>{e.stopPropagation();setOpen(true)}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();setOpen(true)}}}>!</span>{open&&createPortal(<dialog ref={dialog} className="metric-help-dialog" aria-labelledby={id} onCancel={()=>setOpen(false)} onClick={e=>e.stopPropagation()}><h3 id={id}>Как считается показатель</h3><p>{text}</p><button className="button secondary" onClick={()=>setOpen(false)}>Понятно</button></dialog>,document.body)}</>;
}
