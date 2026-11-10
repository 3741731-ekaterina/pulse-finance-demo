
'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ChevronDown,X} from 'lucide-react';
export default function QuickFilter({label,children,icon}:{label:string;children:ReactNode;icon?:ReactNode}){
 const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;function outside(e:PointerEvent){if(!root.current?.contains(e.target as Node))setOpen(false)}function escape(e:KeyboardEvent){if(e.key==='Escape'){setOpen(false);trigger.current?.focus()}}document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}},[open]);
 return <div className="tax-quick-anchor" ref={root}><button ref={trigger} className="filter-chip quick-button" aria-expanded={open} onClick={()=>setOpen(!open)}>{icon}{label}<ChevronDown size={15}/></button>{open&&<div className="tax-popover" role="dialog" aria-label={label}><button className="popover-close" aria-label="Закрыть выбор" onClick={()=>{setOpen(false);trigger.current?.focus()}}><X size={16}/></button>{children}</div>}</div>
}
